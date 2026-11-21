//! Deterministic, accessible SVG output for shapes and compositions.

use crate::error::{DeqError, Result};
use crate::expand::expand_shape;
use crate::format::{escape_xml, is_number, js_mod, num};
use crate::geometry::{self as g, Flat, Kind, Paint, Vec2};
use crate::json::{get, s, strs};
use crate::options::{LAYER, ResolvedOptions, params_issues, resolve_options};
use crate::registry::{Shape, get_shape};
use serde_json::{Map, Value, json};

/// Canvas size in grid units.
pub const CANVAS: f64 = 24.0;
const CENTER: f64 = CANVAS / 2.0;

fn pts(points: &[Vec2]) -> String {
    points
        .iter()
        .map(|(x, y)| format!("{},{}", num(*x), num(*y)))
        .collect::<Vec<_>>()
        .join(" ")
}

/// True when the item outlines an area that `fill` paints.
#[must_use]
pub fn is_closed(item: &Flat) -> bool {
    match &item.kind {
        Kind::Poly { closed, .. } => *closed,
        Kind::Circle { dot, .. } => !dot,
        Kind::Ellipse { .. } => true,
        Kind::Arc { start, end, .. } => end - start >= 360.0,
        Kind::Path { segments } => segments.iter().any(|s| matches!(s, g::Segment::Z)),
    }
}

/// True when the item is painted as a solid area in the ink colour.
#[must_use]
pub fn is_filled(item: &Flat) -> bool {
    item.paint == Paint::Fill || matches!(item.kind, Kind::Circle { dot: true, .. })
}

fn paint_attrs(item: &Flat, o: &ResolvedOptions) -> String {
    if is_filled(item) {
        let op = if o.stroke_opacity == 1.0 {
            String::new()
        } else {
            format!(" fill-opacity=\"{}\"", num(o.stroke_opacity))
        };
        return format!(" fill=\"currentColor\"{op} stroke=\"none\"");
    }
    if o.fill != "none" && is_closed(item) {
        let op = if o.fill_opacity == 1.0 {
            String::new()
        } else {
            format!(" fill-opacity=\"{}\"", num(o.fill_opacity))
        };
        return format!(" fill=\"{}\"{op}", escape_xml(&o.fill));
    }
    String::new()
}

fn circle(cx: f64, cy: f64, r: f64) -> String {
    format!(
        "<circle cx=\"{}\" cy=\"{}\" r=\"{}\"",
        num(cx),
        num(cy),
        num(r)
    )
}

/// One SVG element; stroke attributes are inherited from the root.
#[must_use]
pub fn element(item: &Flat, o: &ResolvedOptions) -> String {
    let paint = paint_attrs(item, o);
    match &item.kind {
        Kind::Poly { points, closed } => {
            if !closed && points.len() == 2 {
                let ((x1, y1), (x2, y2)) = (points[0], points[1]);
                return format!(
                    "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\"/>",
                    num(x1),
                    num(y1),
                    num(x2),
                    num(y2)
                );
            }
            let tag = if *closed { "polygon" } else { "polyline" };
            format!("<{tag} points=\"{}\"{paint}/>", pts(points))
        }
        Kind::Circle { cx, cy, r, dot } => {
            let r = if *dot { r * o.dot_scale } else { *r };
            format!("{}{paint}/>", circle(*cx, *cy, r))
        }
        Kind::Arc {
            cx,
            cy,
            r,
            start,
            end,
        } => {
            let sweep = end - start;
            if sweep >= 360.0 {
                return format!("{}{paint}/>", circle(*cx, *cy, *r));
            }
            let (c0, s0) = g::cos_sin(*start);
            let (c1, s1) = g::cos_sin(*end);
            let rs = num(*r);
            let large = u8::from(sweep > 180.0);
            let a = format!("{} {}", num(cx + r * c0), num(cy + r * s0));
            let b = format!("{} {}", num(cx + r * c1), num(cy + r * s1));
            format!("<path d=\"M{a}A{rs} {rs} 0 {large} 1 {b}\"/>")
        }
        Kind::Ellipse {
            cx,
            cy,
            rx,
            ry,
            rotation,
        } => {
            let rot = if js_mod(*rotation, 360.0) == 0.0 {
                String::new()
            } else {
                format!(
                    " transform=\"rotate({} {} {})\"",
                    num(*rotation),
                    num(*cx),
                    num(*cy)
                )
            };
            format!(
                "<ellipse cx=\"{}\" cy=\"{}\" rx=\"{}\" ry=\"{}\"{rot}{paint}/>",
                num(*cx),
                num(*cy),
                num(*rx),
                num(*ry)
            )
        }
        Kind::Path { segments } => {
            let d: String = segments
                .iter()
                .map(|seg| {
                    let p: Vec<String> = seg
                        .points()
                        .iter()
                        .map(|(x, y)| format!("{} {}", num(*x), num(*y)))
                        .collect();
                    format!("{}{}", seg.command(), p.join(" "))
                })
                .collect();
            format!("<path d=\"{d}\"{paint}/>")
        }
    }
}

/// Hooks for [`svg_document`], used by exporters that need named layer groups.
#[derive(Default)]
pub struct SvgHooks<'a> {
    /// Extra attributes on the root `<svg>`, starting with a space.
    pub root_attrs: String,
    /// Extra attributes for the group of a layer, starting with a space. When given, every layer
    /// gets its own group and the rotation/flip transform moves onto each group.
    pub layer_attrs: Option<&'a dyn Fn(&str) -> String>,
}

fn group_transform(o: &ResolvedOptions) -> String {
    let mut parts: Vec<String> = Vec::new();
    if js_mod(o.rotation, 360.0) != 0.0 {
        parts.push(format!(
            "rotate({} {} {})",
            num(o.rotation),
            num(CENTER),
            num(CENTER)
        ));
    }
    if o.flip_x || o.flip_y {
        let fx = if o.flip_x {
            num(CANVAS)
        } else {
            "0".to_owned()
        };
        let fy = if o.flip_y {
            num(CANVAS)
        } else {
            "0".to_owned()
        };
        parts.push(format!("translate({fx} {fy})"));
        parts.push(format!(
            "scale({} {})",
            if o.flip_x { "-1" } else { "1" },
            if o.flip_y { "-1" } else { "1" }
        ));
    }
    parts.join(" ")
}

fn body(items: &[Flat], o: &ResolvedOptions, hooks: &SvgHooks<'_>) -> String {
    let transform = group_transform(o);
    if o.layer_colors.is_empty() && hooks.layer_attrs.is_none() {
        let inner: String = items.iter().map(|item| element(item, o)).collect();
        return if transform.is_empty() {
            inner
        } else {
            format!("<g transform=\"{transform}\">{inner}</g>")
        };
    }
    // Group by layer in first-use order so each layer can carry its own colour.
    let mut layers: Vec<(&str, String)> = Vec::new();
    for item in items {
        let el = element(item, o);
        match layers.iter_mut().find(|(l, _)| *l == item.layer) {
            Some((_, inner)) => inner.push_str(&el),
            None => layers.push((&item.layer, el)),
        }
    }
    let mut out = String::new();
    for (layer, inner) in layers {
        // Re-declare stroke: SVG 1.1 renderers resolve currentColor where it is declared.
        let style = o.layer_color(layer).map_or_else(String::new, |c| {
            format!(" color=\"{}\" stroke=\"currentColor\"", escape_xml(c))
        });
        let name = escape_xml(layer);
        if let Some(attrs) = hooks.layer_attrs {
            let t = if transform.is_empty() {
                String::new()
            } else {
                format!(" transform=\"{transform}\"")
            };
            out.push_str(&format!(
                "<g{} data-layer=\"{name}\"{style}{t}>{inner}</g>",
                attrs(layer)
            ));
        } else {
            out.push_str(&format!("<g data-layer=\"{name}\"{style}>{inner}</g>"));
        }
    }
    if hooks.layer_attrs.is_none() && !transform.is_empty() {
        return format!("<g transform=\"{transform}\">{out}</g>");
    }
    out
}

/// A shape ready to draw: resolved options and flat geometry in canvas units.
#[derive(Debug, Clone)]
pub struct Prepared {
    /// The resolved options.
    pub options: ResolvedOptions,
    /// Flat geometry in canvas units.
    pub items: Vec<Flat>,
    /// The layer ids of the shape, in declaration order.
    pub layers: Vec<String>,
    /// The title used when `options.title` is not set (the English name).
    pub default_title: String,
}

/// The SVG document for prepared geometry; with default hooks exactly what [`render`] gives.
#[must_use]
pub fn svg_document(p: &Prepared, hooks: &SvgHooks<'_>) -> String {
    let mut out = svg_root(
        &p.options,
        &p.default_title,
        &hooks.root_attrs,
        CANVAS,
        CANVAS,
    );
    out.push_str(&body(&p.items, &p.options, hooks));
    out.push_str("</svg>");
    out
}

/// The root `<svg>` with title and background for a `width` x `height` canvas (grid units).
#[must_use]
pub fn svg_root(
    o: &ResolvedOptions,
    default_title: &str,
    root_attrs: &str,
    width: f64,
    height: f64,
) -> String {
    let bx = CANVAS + 2.0 * o.padding;
    let w = width + 2.0 * o.padding;
    let h = height + 2.0 * o.padding;
    let stroke = if o.absolute_stroke_width {
        (o.stroke_width * bx) / o.size
    } else {
        o.stroke_width
    };
    let title = o.title.as_deref().unwrap_or(default_title);
    let label = o.aria_label.as_deref().unwrap_or(title);
    let a11y = if title.is_empty() && label.is_empty() {
        " aria-hidden=\"true\"".to_owned()
    } else {
        format!(" role=\"img\" aria-label=\"{}\"", escape_xml(label))
    };
    let color = if o.color == "currentColor" {
        String::new()
    } else {
        format!(" color=\"{}\"", escape_xml(&o.color))
    };
    let opacity = if o.stroke_opacity == 1.0 {
        String::new()
    } else {
        format!(" stroke-opacity=\"{}\"", num(o.stroke_opacity))
    };
    let pad = num(-o.padding);
    let (ws, hs) = (num(w), num(h));
    let pw = if width == CANVAS {
        o.size
    } else {
        (o.size * w) / bx
    };
    let ph = if height == CANVAS {
        o.size
    } else {
        (o.size * h) / bx
    };
    let mut out = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\"{root_attrs} width=\"{}\" height=\"{}\" viewBox=\"{pad} {pad} {ws} {hs}\" \
         fill=\"none\" stroke=\"currentColor\" stroke-width=\"{}\" stroke-linecap=\"{}\" stroke-linejoin=\"{}\"{color}{opacity}{a11y}>",
        num(pw),
        num(ph),
        num(stroke),
        o.linecap,
        o.linejoin,
    );
    if !title.is_empty() {
        out.push_str(&format!("<title>{}</title>", escape_xml(title)));
    }
    if o.background != "none" {
        out.push_str(&format!(
            "<rect x=\"{pad}\" y=\"{pad}\" width=\"{ws}\" height=\"{hs}\" fill=\"{}\" stroke=\"none\"/>",
            escape_xml(&o.background)
        ));
    }
    out
}

fn check_layers(shape: &Shape, o: &ResolvedOptions) -> Result<()> {
    let layers = strs(shape, "layers");
    let issues: Vec<String> = o
        .layer_colors
        .keys()
        .filter(|l| !layers.contains(&l.as_str()))
        .map(|l| {
            format!(
                "layerColors.{l}: not a layer of {} ({})",
                s(shape, "id"),
                layers.join(", ")
            )
        })
        .collect();
    if issues.is_empty() {
        Ok(())
    } else {
        Err(DeqError::options("invalid render options", issues))
    }
}

/// Validate `options` for `shape` and expand its geometry.
///
/// # Errors
/// `InvalidOptions` and every error of [`expand_shape`].
pub fn prepare(shape: &Shape, options: &Value) -> Result<Prepared> {
    let o = resolve_options(options)?;
    check_layers(shape, &o)?;
    let items = expand_shape(shape, Some(&o.params))?;
    Ok(Prepared {
        items,
        layers: strs(shape, "layers")
            .into_iter()
            .map(str::to_owned)
            .collect(),
        default_title: s(get(shape, "names"), "en").to_owned(),
        options: o,
    })
}

/// Render a shape description (already validated) to an SVG string.
///
/// # Errors
/// As [`prepare`].
pub fn render_shape_data(shape: &Shape, options: &Value) -> Result<String> {
    Ok(svg_document(
        &prepare(shape, options)?,
        &SvgHooks::default(),
    ))
}

/// Render the catalog shape `shape_id` as a standalone SVG string.
///
/// ```
/// let svg = deq_shapes::render("roj-half-sun", &serde_json::json!({"size": 48, "params": {"rays": 9}})).unwrap();
/// assert!(svg.starts_with("<svg"));
/// ```
///
/// # Errors
/// `UnknownShape`, `InvalidOptions`, `InvalidParameter` or `LimitExceeded`.
pub fn render(shape_id: &str, options: &Value) -> Result<String> {
    render_shape_data(get_shape(shape_id)?, options)
}

fn vec_issue(v: &Value) -> bool {
    !v.as_array()
        .is_some_and(|a| a.len() == 2 && a.iter().all(is_number))
}

fn part_issues(i: usize, part: &Value) -> Vec<String> {
    let at = i.to_string();
    let Some(map) = part.as_object() else {
        return vec![format!("{at}: must be an object")];
    };
    let mut issues: Vec<String> = Vec::new();
    for key in map.keys() {
        if !matches!(key.as_str(), "shape" | "params" | "transform" | "layer") {
            issues.push(format!("{at}.{key}: unknown field"));
        }
    }
    if get(part, "shape")
        .as_str()
        .is_none_or(|x| x.chars().count() > 64)
    {
        issues.push(format!("{at}.shape: must be a shape id"));
    }
    if let Some(p) = map.get("params") {
        issues.extend(params_issues(p, &format!("{at}.params")));
    }
    if map
        .get("layer")
        .is_some_and(|layer| !layer.as_str().is_some_and(|x| LAYER.is_match(x)))
    {
        issues.push(format!("{at}.layer: must be a layer id"));
    }
    if let Some(tr) = map.get("transform") {
        let Some(tr) = tr.as_object() else {
            issues.push(format!("{at}.transform: must be an object"));
            return issues;
        };
        for (key, v) in tr {
            let at = format!("{at}.transform.{key}");
            let x = v.as_f64().filter(|_| is_number(v));
            match key.as_str() {
                "translate" | "origin" => {
                    if vec_issue(v) {
                        issues.push(format!("{at}: must be [x, y]"));
                    }
                }
                "scale" => {
                    if !x.is_some_and(|x| 0.0 < x && x <= 4.0) {
                        issues.push(format!("{at}: must be above 0 and at most 4"));
                    }
                }
                "rotate" => {
                    if !x.is_some_and(|x| (-360.0..=360.0).contains(&x)) {
                        issues.push(format!("{at}: must be from -360 to 360"));
                    }
                }
                _ => issues.push(format!("{at}: unknown field")),
            }
        }
    }
    issues
}

/// The shape description of a composition: one `use` per part, each on its own layer.
///
/// # Errors
/// `InvalidOptions` for malformed parts, `UnknownShape` for unknown shape ids.
pub fn compose_shape(parts: &Value) -> Result<Shape> {
    let mut issues: Vec<String> = Vec::new();
    match parts.as_array() {
        Some(list) if (1..=64).contains(&list.len()) => {
            for (i, part) in list.iter().enumerate() {
                issues.extend(part_issues(i, part));
            }
        }
        _ => issues.push("must be a list of 1 to 64 parts".to_owned()),
    }
    if !issues.is_empty() {
        return Err(DeqError::options("invalid composition", issues));
    }
    let mut primitives: Vec<Value> = Vec::new();
    let mut layers: Vec<String> = Vec::new();
    for p in parts.as_array().map_or(&[][..], Vec::as_slice) {
        let shape = s(p, "shape");
        get_shape(shape)?;
        let layer = p.get("layer").and_then(Value::as_str).unwrap_or(shape);
        let mut use_ = Map::new();
        use_.insert("type".into(), json!("use"));
        use_.insert("shape".into(), json!(shape));
        use_.insert("layer".into(), json!(layer));
        for key in ["params", "transform"] {
            if let Some(v) = p.get(key).filter(|v| !v.is_null()) {
                use_.insert(key.into(), v.clone());
            }
        }
        if !layers.iter().any(|l| l == layer) {
            layers.push(layer.to_owned());
        }
        primitives.push(Value::Object(use_));
    }
    Ok(json!({
        "id": "composition",
        "version": 1,
        "category": "composition",
        "names": {
            "en": "Composition",
            "ckb": {"text": null, "status": "none"},
            "kmr": {"text": null, "status": "none"},
        },
        "aliases": [],
        "tags": [],
        "layers": layers,
        "symmetry": "none",
        "parameters": {},
        "primitives": primitives,
    }))
}

/// `options` with `params` forced to `{}` (compositions take no parameters).
#[must_use]
pub fn without_params(options: &Value) -> Value {
    let mut map = options.as_object().cloned().unwrap_or_default();
    map.insert("params".into(), json!({}));
    Value::Object(map)
}

/// Render several catalog shapes placed on one 24 x 24 canvas (`params` is ignored).
///
/// # Errors
/// As [`compose_shape`] and [`render_shape_data`].
pub fn compose(parts: &Value, options: &Value) -> Result<String> {
    if !options.is_null() && !options.is_object() {
        return Err(DeqError::options(
            "invalid render options",
            vec!["must be an object".to_owned()],
        ));
    }
    render_shape_data(&compose_shape(parts)?, &without_params(options))
}
