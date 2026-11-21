//! The core export formats, the same files as `@0xdolan/deq-exporters` (ADR 0011).
//!
//! SVG and PDF output is byte for byte the TypeScript output; raster formats match in size and
//! type (each port links its own resvg and encoders). The other formats of the Node package
//! (components, CSS, EPS, PSD, favicon packs and so on) are only in the Node CLI.

use crate::color::{BLACK, Rgba, parse_color, to_hex};
use crate::drawing::build_drawing;
use crate::error::{DeqError, ErrorCode, Result};
use crate::format::{escape_xml, is_integer, js_json, js_round, js_str, take_chars};
use crate::json::{get, s};
use crate::pattern::compile;
use crate::pdf::{ColorSpace, write_pdf};
use crate::raster::{ICO_SIZES, MAX_RASTER, RasterFormat, encode_svg, to_ico};
use crate::registry::{Shape, get_shape};
use crate::svg::{Prepared, SvgHooks, compose_shape, prepare, svg_document};
use regex::Regex;
use serde_json::{Map, Value, json};
use std::collections::HashSet;
use std::sync::LazyLock;

/// Every format of the Node exporters, in their order.
pub const FORMATS: [&str; 23] = [
    "svg",
    "svg-layered",
    "svg-sprite",
    "html",
    "jsx",
    "tsx",
    "vue",
    "svelte",
    "data-uri",
    "css-background",
    "css-mask",
    "pdf",
    "ai",
    "eps",
    "png",
    "jpg",
    "webp",
    "avif",
    "ico",
    "favicon",
    "psd",
    "figma",
    "spec-json",
];
/// The formats this port writes.
pub const PORT_FORMATS: [&str; 8] = [
    "svg",
    "svg-layered",
    "svg-sprite",
    "pdf",
    "png",
    "jpg",
    "webp",
    "ico",
];
/// Most items one export call accepts.
pub const MAX_ITEMS: usize = 512;

static NAME: LazyLock<Regex> = LazyLock::new(|| compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"));
static PREFIX: LazyLock<Regex> = LazyLock::new(|| compile(r"^[a-z][a-z0-9-]{0,31}$"));
static SVG_DOC: LazyLock<Regex> = LazyLock::new(|| compile(r"(?s)^<svg ([^>]*)>(.*)</svg>$"));
static HEAD: LazyLock<Regex> =
    LazyLock::new(|| compile(r#"^<g id="([^"]*)" data-layer="([^"]*)""#));
static COLOR_ATTR: LazyLock<Regex> = LazyLock::new(|| compile(r#" color="[^"]*""#));
static A11Y: LazyLock<Regex> =
    LazyLock::new(|| compile(r#" role="img" aria-label="[^"]*"| aria-hidden="true""#));
const KNOWN: [&str; 9] = [
    "render",
    "currentColor",
    "scales",
    "quality",
    "matte",
    "colorSpace",
    "layers",
    "prefix",
    "icoSizes",
];
const INKSCAPE: &str = "http://www.inkscape.org/namespaces/inkscape";
const SYMBOL_DROP: [&str; 6] = [
    "xmlns",
    "width",
    "height",
    "role",
    "aria-label",
    "aria-hidden",
];

/// One output file. `name` never contains a path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportFile {
    /// The file name.
    pub name: String,
    /// The media type.
    pub media_type: &'static str,
    /// The file contents (UTF-8 text for SVG).
    pub data: Vec<u8>,
}

/// An item resolved into a safe file name, its shape and its geometry.
#[derive(Debug, Clone)]
pub struct Resolved {
    /// The file name stem.
    pub name: String,
    /// The shape description.
    pub shape: Shape,
    /// The merged render options.
    pub options: Value,
    /// The prepared geometry.
    pub prepared: Prepared,
}

fn invalid(prefix: &str, issues: Vec<String>) -> DeqError {
    DeqError::options(prefix, issues)
}

fn check_name(name: &Value) -> Result<String> {
    match name.as_str() {
        Some(n) if n.chars().count() <= 64 && NAME.is_match(n) => Ok(n.to_owned()),
        _ => {
            let shown = name
                .as_str()
                .map_or_else(|| js_str(name), |n| js_json(&json!(take_chars(n, 80))));
            Err(invalid(
                "invalid export item",
                vec![format!(
                    "name: must be kebab case, at most 64 characters (got {shown})"
                )],
            ))
        }
    }
}

fn object(v: &Value) -> Map<String, Value> {
    v.as_object().cloned().unwrap_or_default()
}

/// Resolve a shape id, `{"shape", "params", "options", "name"}` or `{"parts", ...}`.
///
/// # Errors
/// `InvalidOptions` for bad names, options or parts, and every error of [`prepare`].
pub fn resolve_item(item: &Value, defaults: &Value) -> Result<Resolved> {
    if let Some(id) = item.as_str() {
        return resolve_item(&json!({ "shape": id }), defaults);
    }
    let base = object(defaults);
    let own = object(get(item, "options"));
    let mut options = base.clone();
    options.extend(own.clone());
    if item.get("parts").is_some() {
        let shape = compose_shape(get(item, "parts"))?;
        options.insert("params".into(), json!({}));
        let options = Value::Object(options);
        let name = check_name(item.get("name").unwrap_or(&json!("composition")))?;
        let prepared = prepare(&shape, &options)?;
        return Ok(Resolved {
            name,
            shape,
            options,
            prepared,
        });
    }
    let shape = get_shape(s(item, "shape"))?;
    let mut params = object(base.get("params").unwrap_or(&Value::Null));
    params.extend(object(own.get("params").unwrap_or(&Value::Null)));
    params.extend(object(get(item, "params")));
    options.insert("params".into(), Value::Object(params));
    let options = Value::Object(options);
    let name = check_name(item.get("name").unwrap_or_else(|| get(shape, "id")))?;
    let prepared = prepare(shape, &options)?;
    Ok(Resolved {
        name,
        shape: shape.clone(),
        options,
        prepared,
    })
}

/// Resolve 1 to 512 items with unique names.
///
/// # Errors
/// `InvalidOptions` for a bad count or duplicate names, and every error of [`resolve_item`].
pub fn resolve_items(items: &[Value], defaults: &Value) -> Result<Vec<Resolved>> {
    if !(1..=MAX_ITEMS).contains(&items.len()) {
        return Err(invalid(
            "invalid export",
            vec![format!(
                "items: give 1 to {MAX_ITEMS} items (got {})",
                items.len()
            )],
        ));
    }
    let out = items
        .iter()
        .map(|i| resolve_item(i, defaults))
        .collect::<Result<Vec<_>>>()?;
    let mut seen = HashSet::new();
    for r in &out {
        if !seen.insert(r.name.as_str()) {
            return Err(invalid(
                "invalid export",
                vec![format!(
                    "items: duplicate name {}; give each item a unique `name`",
                    r.name
                )],
            ));
        }
    }
    Ok(out)
}

/// Split core output into root attributes and inner markup.
#[must_use]
pub fn split_svg(svg: &str) -> Option<(Vec<(String, String)>, String)> {
    let caps = SVG_DOC.captures(svg)?;
    let source = caps.get(1)?.as_str();
    let mut attrs = Vec::new();
    let mut i = 0;
    while let Some(eq) = source[i..].find("=\"").map(|x| x + i) {
        let Some(end) = source[eq + 2..].find('"').map(|x| x + eq + 2) else {
            break;
        };
        attrs.push((
            source[i..eq].trim().to_owned(),
            source[eq + 2..end].to_owned(),
        ));
        i = end + 1;
    }
    Some((attrs, caps.get(2)?.as_str().to_owned()))
}

/// Optimised SVG: core's output (`currentColor` by default).
#[must_use]
pub fn to_svg(r: &Resolved) -> String {
    svg_document(&r.prepared, &SvgHooks::default())
}

/// SVG with one Inkscape layer per shape layer.
#[must_use]
pub fn to_layered_svg(r: &Resolved) -> String {
    let attrs = |layer: &str| {
        let l = escape_xml(layer);
        format!(" id=\"layer-{l}\" inkscape:groupmode=\"layer\" inkscape:label=\"{l}\"")
    };
    svg_document(
        &r.prepared,
        &SvgHooks {
            root_attrs: format!(" xmlns:inkscape=\"{INKSCAPE}\""),
            layer_attrs: Some(&attrs),
        },
    )
}

/// An SVG sprite with one `<symbol id="<prefix><name>">` per item.
#[must_use]
pub fn to_sprite(items: &[Resolved], prefix: &str) -> String {
    let mut symbols = String::new();
    for r in items {
        let Some((attrs, inner)) = split_svg(&to_svg(r)) else {
            continue;
        };
        let kept: String = attrs
            .iter()
            .filter(|(k, _)| !SYMBOL_DROP.contains(&k.as_str()))
            .map(|(k, v)| format!(" {k}=\"{v}\""))
            .collect();
        symbols.push_str(&format!(
            "<symbol id=\"{}\"{kept}>{inner}</symbol>",
            escape_xml(&format!("{prefix}{}", r.name))
        ));
    }
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\" style=\"display:none\">{symbols}</svg>\n"
    )
}

/// SVG with concrete colours instead of `currentColor` and one named group per layer.
///
/// # Errors
/// `InvalidOptions` when a colour cannot be parsed.
pub fn to_figma_svg(r: &Resolved, current_color: Rgba) -> Result<String> {
    let o = &r.prepared.options;
    let root_rgba = parse_color(&o.color, current_color)?;
    let root = to_hex(root_rgba);
    let attrs = |layer: &str| format!(" id=\"{}\"", escape_xml(layer));
    let svg = svg_document(
        &r.prepared,
        &SvgHooks {
            root_attrs: String::new(),
            layer_attrs: Some(&attrs),
        },
    );
    let mut out = String::new();
    let mut i = 0;
    while let Some(start) = svg[i..].find("<g id=\"").map(|x| x + i) {
        let Some(open) = svg[start..].find('>').map(|x| x + start) else {
            break;
        };
        let Some(close) = svg[open..].find("</g>").map(|x| x + open) else {
            break;
        };
        out.push_str(&svg[i..start]);
        if let Some(head) = HEAD.captures(&svg[start..open]) {
            let (Some(whole), Some(id), Some(layer)) = (head.get(0), head.get(1), head.get(2))
            else {
                break;
            };
            let c = to_hex(parse_color(
                o.layer_color(layer.as_str()).unwrap_or(&o.color),
                root_rgba,
            )?);
            let rest = COLOR_ATTR.replacen(&svg[start + whole.end()..open], 1, "");
            let rest = rest.replacen(" stroke=\"currentColor\"", "", 1);
            let inner = svg[open + 1..close].replace("currentColor", &c);
            out.push_str(&format!(
                "<g id=\"{}\" stroke=\"{c}\"{rest}>{inner}</g>",
                id.as_str()
            ));
        } else {
            out.push_str(&svg[start..close + 4]);
        }
        i = close + 4;
    }
    out.push_str(&svg[i..]);
    let result = COLOR_ATTR.replacen(&out, 1, "");
    let result = A11Y.replacen(&result, 1, "");
    Ok(result.replace("currentColor", &root))
}

fn int_list(v: &Value, hi: f64, most: usize) -> Option<Vec<u32>> {
    let list = v.as_array()?;
    if !(1..=most).contains(&list.len()) {
        return None;
    }
    list.iter()
        .map(|x| {
            let n = x
                .as_f64()
                .filter(|n| is_integer(x) && (1.0..=hi).contains(n))?;
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            Some(n as u32)
        })
        .collect()
}

fn check_options(fmt: &str, options: &Map<String, Value>) -> Result<()> {
    if !FORMATS.contains(&fmt) {
        let issue = format!(
            "format: must be one of {} (got {})",
            FORMATS.join(", "),
            js_json(&json!(take_chars(fmt, 40)))
        );
        return Err(invalid("invalid export options", vec![issue]));
    }
    let mut issues: Vec<String> = options
        .keys()
        .filter(|k| !KNOWN.contains(&k.as_str()))
        .map(|k| format!("{k}: unknown option"))
        .collect();
    for key in ["currentColor", "matte"] {
        if options
            .get(key)
            .filter(|v| !v.is_null())
            .is_some_and(|v| v.as_str().is_none_or(|x| x.chars().count() > 64))
        {
            issues.push(format!("{key}: must be a string of at most 64 characters"));
        }
    }
    for (key, hi, most) in [("scales", 8.0, 8), ("icoSizes", 256.0, 8)] {
        let Some(v) = options.get(key).filter(|v| !v.is_null()) else {
            continue;
        };
        match int_list(v, hi, most) {
            None => issues.push(format!(
                "{key}: must be 1 to {most} integers from 1 to {hi}"
            )),
            Some(list)
                if key == "scales" && list.iter().collect::<HashSet<_>>().len() != list.len() =>
            {
                issues.push("scales: scales must be unique".to_owned());
            }
            Some(_) => {}
        }
    }
    if let Some(q) = options.get("quality").filter(|v| !v.is_null()) {
        if !(is_integer(q) && q.as_f64().is_some_and(|x| (0.0..=100.0).contains(&x))) {
            issues.push(format!(
                "quality: must be an integer from 0 to 100 (got {})",
                js_str(q)
            ));
        }
    }
    if !options
        .get("colorSpace")
        .is_none_or(|v| v.as_str().is_some_and(|x| x == "rgb" || x == "cmyk"))
    {
        issues.push("colorSpace: must be \"rgb\" or \"cmyk\"".to_owned());
    }
    if !options.get("layers").is_none_or(Value::is_boolean) {
        issues.push("layers: must be true or false".to_owned());
    }
    if !options
        .get("prefix")
        .is_none_or(|v| v.as_str().is_some_and(|x| PREFIX.is_match(x)))
    {
        issues.push("prefix: must match /^[a-z][a-z0-9-]{0,31}$/".to_owned());
    }
    if issues.is_empty() {
        Ok(())
    } else {
        Err(invalid("invalid export options", issues))
    }
}

fn pixel_width(r: &Resolved, scale: u32) -> Result<f64> {
    let width = js_round(r.prepared.options.size * f64::from(scale));
    if width > f64::from(MAX_RASTER) {
        let issue = format!(
            "scales: {} at {scale}x is {} px, more than {MAX_RASTER}",
            r.name,
            crate::format::js_number(width)
        );
        return Err(invalid("invalid export options", vec![issue]));
    }
    Ok(width)
}

/// The error for a format only the Node CLI writes.
#[must_use]
pub fn node_only(fmt: &str) -> DeqError {
    let msg = format!("format \"{fmt}\" is only available in the Node CLI (npx @0xdolan/deq-cli)");
    DeqError {
        code: ErrorCode::InvalidOptions,
        message: msg.clone(),
        issues: vec![msg],
    }
}

fn color_opt(o: &Map<String, Value>, key: &str, default: &str) -> Result<Rgba> {
    let text = o
        .get(key)
        .and_then(Value::as_str)
        .filter(|x| !x.is_empty())
        .unwrap_or(default);
    parse_color(text, BLACK)
}

fn per_item(fmt: &str, r: &Resolved, o: &Map<String, Value>) -> Result<Vec<ExportFile>> {
    let current = color_opt(o, "currentColor", "#000000")?;
    match fmt {
        "svg" | "svg-layered" => {
            let svg = if fmt == "svg" {
                to_svg(r)
            } else {
                to_layered_svg(r)
            };
            Ok(vec![ExportFile {
                name: format!("{}.svg", r.name),
                media_type: "image/svg+xml",
                data: format!("{svg}\n").into_bytes(),
            }])
        }
        "pdf" => {
            let space = if o.get("colorSpace").and_then(Value::as_str) == Some("cmyk") {
                ColorSpace::Cmyk
            } else {
                ColorSpace::Rgb
            };
            let layers = o.get("layers").and_then(Value::as_bool).unwrap_or(true);
            let pdf = write_pdf(&build_drawing(&r.prepared, current)?, space, layers, "Deq");
            Ok(vec![ExportFile {
                name: format!("{}.pdf", r.name),
                media_type: "application/pdf",
                data: pdf,
            }])
        }
        "png" | "jpg" | "webp" => {
            let (kind, media_type) = match fmt {
                "png" => (RasterFormat::Png, "image/png"),
                "jpg" => (RasterFormat::Jpg, "image/jpeg"),
                _ => (RasterFormat::Webp, "image/webp"),
            };
            let svg = to_figma_svg(r, current)?;
            let matte = color_opt(o, "matte", "#ffffff")?;
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            let quality = o.get("quality").and_then(Value::as_f64).map(|q| q as u8);
            let scales = o
                .get("scales")
                .and_then(|v| int_list(v, 8.0, 8))
                .unwrap_or_else(|| vec![1]);
            let mut files = Vec::new();
            for scale in scales {
                let suffix = if scale == 1 {
                    String::new()
                } else {
                    format!("@{scale}x")
                };
                let data = encode_svg(&svg, pixel_width(r, scale)?, kind, quality, matte)?;
                files.push(ExportFile {
                    name: format!("{}{suffix}.{fmt}", r.name),
                    media_type,
                    data,
                });
            }
            Ok(files)
        }
        "ico" => {
            let sizes = o
                .get("icoSizes")
                .and_then(|v| int_list(v, 256.0, 8))
                .unwrap_or_else(|| ICO_SIZES.to_vec());
            let ico = to_ico(&to_svg(r), &sizes)?;
            Ok(vec![ExportFile {
                name: format!("{}.ico", r.name),
                media_type: "image/vnd.microsoft.icon",
                data: ico,
            }])
        }
        _ => Err(node_only(fmt)),
    }
}

/// Export items to a format; file names are unique and never contain a path.
///
/// `options` (a JSON object or `null`) uses the keys of the TypeScript `ExportOptions`: `render`,
/// `currentColor`, `scales`, `quality`, `matte`, `colorSpace`, `layers`, `prefix` and `icoSizes`.
/// Items are shape ids or objects as [`resolve_item`] takes them.
///
/// # Errors
/// `InvalidOptions` for bad options or a format only the Node CLI writes, and every error of
/// [`resolve_items`].
pub fn export_shapes(fmt: &str, items: &[Value], options: &Value) -> Result<Vec<ExportFile>> {
    let o = object(options);
    check_options(fmt, &o)?;
    for key in ["currentColor", "matte"] {
        if let Some(text) = o.get(key).and_then(Value::as_str) {
            parse_color(text, BLACK)?;
        }
    }
    let resolved = resolve_items(items, o.get("render").unwrap_or(&Value::Null))?;
    if fmt == "svg-sprite" {
        let prefix = o.get("prefix").and_then(Value::as_str).unwrap_or("deq-");
        return Ok(vec![ExportFile {
            name: "deq-sprite.svg".to_owned(),
            media_type: "image/svg+xml",
            data: to_sprite(&resolved, prefix).into_bytes(),
        }]);
    }
    // Item names are unique kebab case and scale suffixes contain "@", so file names never
    // collide here (the Node exporters also check formats that change case, like components).
    let mut files = Vec::new();
    for r in &resolved {
        files.extend(per_item(fmt, r, &o)?);
    }
    Ok(files)
}
