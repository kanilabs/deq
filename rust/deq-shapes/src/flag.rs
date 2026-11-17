//! The Kurdish flag (`spec/flag.json`) as a standalone SVG, in each of its variants.

use crate::data::data;
use crate::error::{DeqError, Result};
use crate::format::{escape_xml, is_integer, js_json, num, round_half_even, take_chars};
use crate::geometry::star_points;
use crate::json::{arr, f, get, s, vec2};
use serde_json::{Value, json};

fn flag() -> &'static Value {
    get(data(), "flag")
}

/// Variant ids in spec order.
#[must_use]
pub fn list_flag_variants() -> Vec<&'static str> {
    arr(flag(), "variants").iter().map(|x| s(x, "id")).collect()
}

fn invalid(lines: Vec<String>) -> DeqError {
    DeqError::options("invalid flag options", lines)
}

/// The pixel size of the flag at `width` px for a variant.
#[must_use]
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub fn flag_size(variant: &Value, width: u32) -> (u32, u32) {
    let h = round_half_even(
        (f64::from(width) * vec2(get(flag(), "viewBox")).1) / vec2(get(variant, "crop")).1,
    );
    (width, h.max(1.0) as u32)
}

/// The variant with this id.
///
/// # Errors
/// `InvalidOptions` for an unknown id.
pub fn get_flag_variant(variant_id: &str) -> Result<&'static Value> {
    if let Some(x) = arr(flag(), "variants")
        .iter()
        .find(|x| s(x, "id") == variant_id)
    {
        return Ok(x);
    }
    let known = list_flag_variants().join(", ");
    Err(invalid(vec![format!(
        "variant: must be one of {known} (got {})",
        js_json(&json!(take_chars(variant_id, 64)))
    )]))
}

fn check(options: &serde_json::Map<String, Value>) -> Vec<String> {
    let mut issues = Vec::new();
    for (key, v) in options {
        match key.as_str() {
            "variant" => {
                if v.as_str().is_none_or(|x| x.chars().count() > 64) {
                    issues.push("variant: must be text of at most 64 chars".to_owned());
                }
            }
            "width" => {
                if !(is_integer(v) && v.as_f64().is_some_and(|x| (1.0..=8192.0).contains(&x))) {
                    issues.push("width: must be an integer from 1 to 8192".to_owned());
                }
            }
            "title" => {
                if v.as_str().is_none_or(|x| x.chars().count() > 256) {
                    issues.push("title: must be text of at most 256 chars".to_owned());
                }
            }
            _ => issues.push(format!("{key}: unknown option")),
        }
    }
    issues
}

/// Render the Kurdish flag as a standalone SVG string.
///
/// Options (a JSON object, or `null`): `variant` (default `full-color`), `width` in px (default
/// 900) and `title` (default "Flag of Kurdistan"; `""` marks the image decorative).
///
/// # Errors
/// `InvalidOptions` for unknown options, bad values or an unknown variant.
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::too_many_lines
)]
pub fn render_flag(options: &Value) -> Result<String> {
    let empty = serde_json::Map::new();
    let opts = match options {
        Value::Null => &empty,
        Value::Object(m) => m,
        _ => return Err(invalid(vec!["must be an object".to_owned()])),
    };
    let issues = check(opts);
    if !issues.is_empty() {
        return Err(invalid(issues));
    }
    let fl = flag();
    let variant = get_flag_variant(
        opts.get("variant")
            .and_then(Value::as_str)
            .unwrap_or("full-color"),
    )?;
    let width = opts.get("width").and_then(Value::as_f64).unwrap_or(900.0) as u32;
    let (width, height) = flag_size(variant, width);
    let (x0, w) = vec2(get(variant, "crop"));
    let h = vec2(get(fl, "viewBox")).1;
    let sw = f(variant, "strokeWidth");
    let title = opts
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or_else(|| s(fl, "name"));
    let a11y = if title.is_empty() {
        " aria-hidden=\"true\"".to_owned()
    } else {
        format!(" role=\"img\" aria-label=\"{}\"", escape_xml(title))
    };
    let stroke = |c: &str| format!(" fill=\"none\" stroke=\"{c}\" stroke-width=\"{}\"", num(sw));
    let rect = |y: f64, hh: f64, fill: &str| {
        format!(
            "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{fill}\"/>",
            num(x0),
            num(y),
            num(w),
            num(hh)
        )
    };
    let mut out = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"{} 0 {} {}\"{a11y}>",
        num(f64::from(width)),
        num(f64::from(height)),
        num(x0),
        num(w),
        num(h)
    );
    if !title.is_empty() {
        out.push_str(&format!("<title>{}</title>", escape_xml(title)));
    }
    if let Some(field) = get(variant, "field").as_str() {
        out.push_str(&rect(0.0, h, field));
    }
    let bands = arr(fl, "bands");
    if get(variant, "bands").as_bool().unwrap_or(false) {
        for b in bands {
            out.push_str(&rect(f(b, "y"), f(b, "height"), s(b, "color")));
        }
    }
    let sun = get(fl, "sun");
    let (cx, cy) = vec2(get(sun, "center"));
    let rays = get(sun, "rays")
        .as_u64()
        .and_then(|x| u32::try_from(x).ok())
        .unwrap_or(21);
    let pts = star_points(
        cx,
        cy,
        rays,
        f(sun, "outerRadius"),
        f(sun, "innerRadius"),
        f(sun, "rotation"),
    );
    let points = pts
        .iter()
        .map(|(x, y)| format!("{},{}", num(*x), num(*y)))
        .collect::<Vec<_>>()
        .join(" ");
    if let Some(c) = get(variant, "sun").as_str() {
        out.push_str(&format!("<polygon points=\"{points}\" fill=\"{c}\"/>"));
    }
    if let Some(c) = get(variant, "sunOutline").as_str() {
        out.push_str(&format!(
            "<polygon points=\"{points}\"{} stroke-linejoin=\"round\"/>",
            stroke(c)
        ));
    }
    if let Some(c) = get(variant, "dividers").as_str() {
        let d: String = bands
            .iter()
            .filter(|b| f(b, "y") > 0.0)
            .map(|b| format!("M{} {}H{}", num(x0), num(f(b, "y")), num(x0 + w)))
            .collect();
        out.push_str(&format!("<path d=\"{d}\"{}/>", stroke(c)));
    }
    if let Some(c) = get(variant, "frame").as_str() {
        out.push_str(&format!(
            "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\"{}/>",
            num(x0 + sw / 2.0),
            num(sw / 2.0),
            num(w - sw),
            num(h - sw),
            stroke(c)
        ));
    }
    out.push_str("</svg>");
    Ok(out)
}
