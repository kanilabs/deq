//! Render options (PRD §8.1), their defaults and runtime validation.
//!
//! Options are JSON objects with the same camelCase names as the TypeScript reference, so one
//! options object works in every port: `{"size": 48, "strokeWidth": 1.5, "params": {"rays": 9}}`.

use crate::error::{DeqError, Result};
use crate::format::{is_number, js_number, js_str};
use crate::pattern::compile;
use regex::Regex;
use serde_json::{Map, Value};
use std::sync::LazyLock;

/// CSS colours accepted in options: hex, named colours and colour functions with plain numeric
/// arguments. `url(...)`, `var(...)` and anything that could reference external content are
/// rejected.
pub static COLOR: LazyLock<Regex> = LazyLock::new(|| {
    compile(concat!(
        r"^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]{3,32}",
        r"|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([0-9a-zA-Z.,%/\s+-]{1,64}\))$",
    ))
});
/// A layer id (kebab case).
pub static LAYER: LazyLock<Regex> = LazyLock::new(|| compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"));
/// A parameter name (camel case).
pub static PARAM: LazyLock<Regex> = LazyLock::new(|| compile(r"^[a-z][a-zA-Z0-9]*$"));

/// Options after validation, with every default filled in.
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs, clippy::struct_excessive_bools)]
pub struct ResolvedOptions {
    pub size: f64,
    pub color: String,
    pub stroke_width: f64,
    pub absolute_stroke_width: bool,
    pub fill: String,
    pub fill_opacity: f64,
    pub stroke_opacity: f64,
    pub linecap: String,
    pub linejoin: String,
    pub dot_scale: f64,
    pub rotation: f64,
    pub flip_x: bool,
    pub flip_y: bool,
    pub padding: f64,
    pub background: String,
    pub layer_colors: Map<String, Value>,
    pub title: Option<String>,
    pub aria_label: Option<String>,
    pub params: Map<String, Value>,
}

impl Default for ResolvedOptions {
    fn default() -> Self {
        Self {
            size: 24.0,
            color: "currentColor".to_owned(),
            stroke_width: 2.0,
            absolute_stroke_width: false,
            fill: "none".to_owned(),
            fill_opacity: 1.0,
            stroke_opacity: 1.0,
            linecap: "round".to_owned(),
            linejoin: "round".to_owned(),
            dot_scale: 1.0,
            rotation: 0.0,
            flip_x: false,
            flip_y: false,
            padding: 0.0,
            background: "none".to_owned(),
            layer_colors: Map::new(),
            title: None,
            aria_label: None,
            params: Map::new(),
        }
    }
}

impl ResolvedOptions {
    /// The colour of a layer (its `layerColors` entry), if one is set.
    #[must_use]
    pub fn layer_color(&self, layer: &str) -> Option<&str> {
        self.layer_colors.get(layer).and_then(Value::as_str)
    }
}

fn number(v: &Value, lo: f64, hi: f64, exclusive_lo: bool) -> Option<String> {
    let Some(x) = v.as_f64().filter(|_| is_number(v)) else {
        return Some("must be a finite number".to_owned());
    };
    if x < lo || (exclusive_lo && x == lo) || x > hi {
        return Some(format!(
            "must be from {} to {} (got {})",
            js_number(lo),
            js_number(hi),
            js_str(v)
        ));
    }
    None
}

fn boolean(v: &Value) -> Option<String> {
    (!v.is_boolean()).then(|| "must be true or false".to_owned())
}

fn color(v: &Value) -> Option<String> {
    match v.as_str() {
        Some(s) if s.chars().count() <= 80 && COLOR.is_match(s) => None,
        _ => Some("must be a CSS colour".to_owned()),
    }
}

fn color_or_none(v: &Value) -> Option<String> {
    if v.as_str() == Some("none") {
        None
    } else {
        color(v)
    }
}

fn text(v: &Value) -> Option<String> {
    match v.as_str() {
        Some(s) if s.chars().count() <= 256 => None,
        _ => Some("must be text of at most 256 chars".to_owned()),
    }
}

fn picklist(v: &Value, values: &[&str]) -> Option<String> {
    match v.as_str() {
        Some(s) if values.contains(&s) => None,
        _ => Some(format!("must be one of {}", values.join(", "))),
    }
}

/// Problems with shape parameter overrides such as `{"rays": 9, "centerDot": false}`.
#[must_use]
pub fn params_issues(v: &Value, prefix: &str) -> Vec<String> {
    let Some(map) = v.as_object() else {
        return vec![format!("{prefix}: must be an object")];
    };
    let mut issues = Vec::new();
    for (k, x) in map {
        if !PARAM.is_match(k) {
            issues.push(format!("{prefix}.{k}: must be a parameter name"));
        }
        let ok =
            is_number(x) || x.is_boolean() || x.as_str().is_some_and(|s| s.chars().count() <= 64);
        if !ok {
            issues.push(format!(
                "{prefix}.{k}: must be a number, boolean or short text"
            ));
        }
    }
    if map.len() > 32 {
        issues.push(format!("{prefix}: at most 32 parameters"));
    }
    issues
}

fn layer_colors_issues(v: &Value) -> Vec<String> {
    let Some(map) = v.as_object() else {
        return vec!["layerColors: must be an object".to_owned()];
    };
    let mut issues = Vec::new();
    for (k, c) in map {
        if !LAYER.is_match(k) {
            issues.push(format!("layerColors.{k}: must be a layer id"));
        }
        if let Some(msg) = color(c) {
            issues.push(format!("layerColors.{k}: {msg}"));
        }
    }
    if map.len() > 64 {
        issues.push("layerColors: at most 64 layer colours".to_owned());
    }
    issues
}

/// Every accepted option name.
pub const OPTION_NAMES: [&str; 19] = [
    "size",
    "color",
    "strokeWidth",
    "absoluteStrokeWidth",
    "fill",
    "fillOpacity",
    "strokeOpacity",
    "linecap",
    "linejoin",
    "dotScale",
    "rotation",
    "flipX",
    "flipY",
    "padding",
    "background",
    "title",
    "ariaLabel",
    "layerColors",
    "params",
];

/// `None` for an option this table does not cover, else the problem with the value, if any.
#[allow(clippy::option_option)]
fn check(key: &str, v: &Value) -> Option<Option<String>> {
    Some(match key {
        "size" => number(v, 1.0, 8192.0, false),
        "color" => color(v),
        "strokeWidth" => number(v, 0.05, 12.0, false),
        "absoluteStrokeWidth" | "flipX" | "flipY" => boolean(v),
        "fill" | "background" => color_or_none(v),
        "fillOpacity" | "strokeOpacity" => number(v, 0.0, 1.0, false),
        "linecap" => picklist(v, &["round", "butt", "square"]),
        "linejoin" => picklist(v, &["round", "miter", "bevel"]),
        "dotScale" => number(v, 0.1, 4.0, false),
        "rotation" => number(v, -3600.0, 3600.0, false),
        "padding" => number(v, 0.0, 24.0, false),
        "title" | "ariaLabel" => text(v),
        _ => return None,
    })
}

fn set(o: &mut ResolvedOptions, key: &str, v: &Value) {
    let f = v.as_f64().unwrap_or(f64::NAN);
    let b = v.as_bool().unwrap_or(false);
    let s = || v.as_str().unwrap_or("").to_owned();
    match key {
        "size" => o.size = f,
        "color" => o.color = s(),
        "strokeWidth" => o.stroke_width = f,
        "absoluteStrokeWidth" => o.absolute_stroke_width = b,
        "fill" => o.fill = s(),
        "fillOpacity" => o.fill_opacity = f,
        "strokeOpacity" => o.stroke_opacity = f,
        "linecap" => o.linecap = s(),
        "linejoin" => o.linejoin = s(),
        "dotScale" => o.dot_scale = f,
        "rotation" => o.rotation = f,
        "flipX" => o.flip_x = b,
        "flipY" => o.flip_y = b,
        "padding" => o.padding = f,
        "background" => o.background = s(),
        "title" => o.title = Some(s()),
        "ariaLabel" => o.aria_label = Some(s()),
        "layerColors" => o.layer_colors = v.as_object().cloned().unwrap_or_default(),
        _ => o.params = v.as_object().cloned().unwrap_or_default(),
    }
}

/// Validate `options` (a JSON object, or `null` for the defaults) and fill in defaults.
///
/// # Errors
/// `InvalidOptions` listing every problem.
pub fn resolve_options(options: &Value) -> Result<ResolvedOptions> {
    let mut o = ResolvedOptions::default();
    if options.is_null() {
        return Ok(o);
    }
    let Some(map) = options.as_object() else {
        return Err(DeqError::options(
            "invalid render options",
            vec!["must be an object".to_owned()],
        ));
    };
    let mut issues: Vec<String> = Vec::new();
    for (key, value) in map {
        match key.as_str() {
            "layerColors" => issues.extend(layer_colors_issues(value)),
            "params" => issues.extend(params_issues(value, "params")),
            k => match check(k, value) {
                Some(Some(msg)) => issues.push(format!("{key}: {msg}")),
                Some(None) => {}
                None => {
                    issues.push(format!("{key}: unknown option"));
                    continue;
                }
            },
        }
        set(&mut o, key, value);
    }
    if !issues.is_empty() {
        return Err(DeqError::options("invalid render options", issues));
    }
    Ok(o)
}
