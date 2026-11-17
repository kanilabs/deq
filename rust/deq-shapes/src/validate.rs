//! `deq validate`: a structural check of a shape spec, then a render of every variant.
//!
//! The same table and messages as `packages/cli/src/validate.ts` and the Python port.

use crate::error::{DeqError, ErrorCode, Result};
use crate::format::{is_integer, is_number, js_equal};
use crate::json::{get, obj, s};
use crate::pattern::compile;
use crate::registry::Shape;
use crate::svg::prepare;
use regex::Regex;
use serde_json::{Map, Value, json};
use std::sync::LazyLock;

/// Fields of each primitive type; `?` marks an optional field.
pub const PRIMITIVES: [(&str, &[(&str, &str)]); 14] = [
    (
        "line",
        &[("x1", "num"), ("y1", "num"), ("x2", "num"), ("y2", "num")],
    ),
    ("polyline", &[("points", "vecs")]),
    ("polygon", &[("points", "vecs"), ("paint?", "paint")]),
    ("path", &[("d", "str"), ("paint?", "paint")]),
    (
        "circle",
        &[
            ("cx", "num"),
            ("cy", "num"),
            ("r", "num"),
            ("paint?", "paint"),
        ],
    ),
    ("dot", &[("cx", "num"), ("cy", "num"), ("r?", "num")]),
    (
        "arc",
        &[
            ("cx", "num"),
            ("cy", "num"),
            ("r", "num"),
            ("start", "num"),
            ("end", "num"),
        ],
    ),
    (
        "ellipse",
        &[
            ("cx", "num"),
            ("cy", "num"),
            ("rx", "num"),
            ("ry", "num"),
            ("paint?", "paint"),
        ],
    ),
    (
        "rect",
        &[
            ("x", "num"),
            ("y", "num"),
            ("width", "num"),
            ("height", "num"),
            ("paint?", "paint"),
        ],
    ),
    (
        "star",
        &[
            ("cx", "num"),
            ("cy", "num"),
            ("points", "count"),
            ("outerRadius", "num"),
            ("innerRadius", "num"),
            ("rotation", "num"),
            ("paint?", "paint"),
        ],
    ),
    (
        "radial",
        &[
            ("count", "count"),
            ("center", "vec"),
            ("start", "num"),
            ("sweep", "num"),
            ("element", "prim"),
        ],
    ),
    (
        "repeat",
        &[
            ("count", "count"),
            ("step?", "vec"),
            ("spread?", "vec"),
            ("align?", "align"),
            ("element", "prim"),
        ],
    ),
    (
        "concentric",
        &[
            ("count", "count"),
            ("center", "vec"),
            ("scaleStep", "num"),
            ("element", "prim"),
        ],
    ),
    (
        "use",
        &[
            ("shape", "str"),
            ("params?", "params"),
            ("transform?", "transform"),
        ],
    ),
];
const COMMON: [(&str, &str); 4] = [
    ("type?", "str"),
    ("id?", "str"),
    ("layer?", "str"),
    ("when?", "when"),
];
const TRANSFORM: [(&str, &str); 4] = [
    ("translate?", "vec"),
    ("scale?", "num"),
    ("rotate?", "num"),
    ("origin?", "vec"),
];
/// Top-level fields that do not affect rendering and are not checked.
const DOC_FIELDS: [&str; 7] = [
    "$schema",
    "meaning",
    "sources",
    "construction",
    "references",
    "metrics",
    "symmetryCenter",
];
const TOP: [&str; 10] = [
    "id",
    "version",
    "category",
    "names",
    "aliases",
    "tags",
    "layers",
    "symmetry",
    "parameters",
    "primitives",
];
const OPTIONAL: [&str; 3] = ["aliases", "tags", "symmetry"];
static KEBAB: LazyLock<Regex> = LazyLock::new(|| compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"));
/// Largest spec file `validate` reads.
pub const MAX_SPEC_BYTES: usize = 256 * 1024;
/// Integer parameters with a wider range are checked at min, default and max only.
const MAX_RANGE: f64 = 64.0;
const MAX_NESTING: usize = 8;

type Check = std::result::Result<(), String>;

fn fail(path: &str, what: &str) -> Check {
    Err(format!("{path}: {what}"))
}

fn is_vec(x: &Value) -> bool {
    x.as_array()
        .is_some_and(|a| a.len() == 2 && a.iter().all(is_number))
}

fn is_str_list(x: &Value) -> bool {
    x.as_array().is_some_and(|a| a.iter().all(Value::is_string))
}

fn is_scalar(v: &Value) -> bool {
    is_number(v) || v.is_boolean() || v.is_string()
}

fn check_value(path: &str, kind: &str, x: &Value, depth: usize) -> Check {
    match kind {
        "num" if !is_number(x) => fail(path, "must be a number"),
        "vec" if !is_vec(x) => fail(path, "must be an [x, y] pair"),
        "vecs" if !x.as_array().is_some_and(|a| a.iter().all(is_vec)) => {
            fail(path, "must be a list of [x, y] pairs")
        }
        "str" if !x.is_string() => fail(path, "must be a string"),
        "count" => {
            let ok = match x.as_object() {
                Some(m) => m.len() == 1 && m.get("param").is_some_and(Value::is_string),
                None => is_number(x),
            };
            if ok {
                Ok(())
            } else {
                fail(path, "must be a number or {\"param\": name}")
            }
        }
        "paint" if !matches!(x.as_str(), Some("stroke" | "fill")) => {
            fail(path, "must be \"stroke\" or \"fill\"")
        }
        "align" if !matches!(x.as_str(), Some("start" | "center")) => {
            fail(path, "must be \"start\" or \"center\"")
        }
        "prim" => check_primitive(path, x, depth + 1),
        "num" | "vec" | "vecs" | "str" | "paint" | "align" => Ok(()),
        _ => {
            let Some(m) = x.as_object() else {
                return fail(path, "must be an object");
            };
            match kind {
                "params" => {
                    for (k, v) in m {
                        if !is_scalar(v) {
                            return fail(
                                &format!("{path}.{k}"),
                                "must be a number, true, false or a string",
                            );
                        }
                    }
                    Ok(())
                }
                "transform" => check_fields(path, m, &[&TRANSFORM], depth),
                _ => {
                    for (k, v) in m {
                        let list = v
                            .as_array()
                            .is_some_and(|a| a.iter().all(|e| is_number(e) || e.is_string()));
                        if !(is_scalar(v) || list) {
                            return fail(
                                &format!("{path}.{k}"),
                                "must be a value or a list of values",
                            );
                        }
                    }
                    Ok(())
                }
            }
        }
    }
}

fn check_fields(
    path: &str,
    x: &Map<String, Value>,
    groups: &[&[(&str, &str)]],
    depth: usize,
) -> Check {
    let fields: Vec<(&str, &str)> = groups.iter().flat_map(|g| g.iter().copied()).collect();
    let name = |raw: &str| raw.replacen('?', "", 1);
    for key in x.keys() {
        if !fields.iter().any(|(raw, _)| name(raw) == *key) {
            return fail(path, &format!("unknown field \"{key}\""));
        }
    }
    for (raw, kind) in fields {
        let key = name(raw);
        match x.get(&key) {
            Some(v) => check_value(&format!("{path}.{key}"), kind, v, depth)?,
            None if !raw.ends_with('?') => return fail(path, &format!("missing field \"{key}\"")),
            None => {}
        }
    }
    Ok(())
}

fn check_primitive(path: &str, x: &Value, depth: usize) -> Check {
    if depth > MAX_NESTING {
        return fail(path, "nested too deeply");
    }
    let Some(m) = x.as_object() else {
        return fail(path, "must be an object");
    };
    let t = m.get("type").and_then(Value::as_str);
    let Some((_, fields)) = PRIMITIVES.iter().find(|(name, _)| Some(*name) == t) else {
        let names: Vec<&str> = PRIMITIVES.iter().map(|(n, _)| *n).collect();
        return fail(
            &format!("{path}.type"),
            &format!("must be one of {}", names.join(", ")),
        );
    };
    check_fields(path, m, &[&COMMON, fields], depth)
}

fn check_kurdish(path: &str, x: &Value) -> Check {
    if !x.is_object() {
        return fail(path, "must be an object");
    }
    let text = get(x, "text");
    if !(text.is_null() || text.is_string()) {
        return fail(&format!("{path}.text"), "must be a string or null");
    }
    if !get(x, "status").is_string() {
        return fail(&format!("{path}.status"), "must be a string");
    }
    Ok(())
}

fn check_parameter(path: &str, p: &Value) -> Check {
    if !p.is_object() {
        return fail(path, "must be an object");
    }
    if !get(p, "description").is_string() {
        return fail(&format!("{path}.description"), "must be a string");
    }
    match get(p, "type").as_str() {
        Some("integer") => {
            if !["min", "max", "default"]
                .iter()
                .all(|k| is_integer(get(p, k)))
            {
                return fail(path, "min, max and default must be integers");
            }
            let n = |k: &str| get(p, k).as_f64().unwrap_or(f64::NAN);
            if !(n("min") <= n("default") && n("default") <= n("max")) {
                return fail(path, "default must be between min and max");
            }
            Ok(())
        }
        Some("boolean") if !get(p, "default").is_boolean() => {
            fail(&format!("{path}.default"), "must be true or false")
        }
        Some("boolean") => Ok(()),
        Some("enum") => {
            let values = get(p, "values");
            if !is_str_list(values) || values.as_array().is_some_and(Vec::is_empty) {
                return fail(
                    &format!("{path}.values"),
                    "must be a non-empty list of strings",
                );
            }
            let d = get(p, "default");
            if !(d.is_string() && values.as_array().is_some_and(|a| a.contains(d))) {
                return fail(&format!("{path}.default"), "must be one of the values");
            }
            Ok(())
        }
        _ => fail(&format!("{path}.type"), "must be integer, boolean or enum"),
    }
}

fn check_top(key: &str, v: &Value) -> Check {
    match key {
        "id" => {
            if v.as_str()
                .is_some_and(|x| x.chars().count() <= 64 && KEBAB.is_match(x))
            {
                Ok(())
            } else {
                fail(key, "must be kebab case, at most 64 characters")
            }
        }
        "version" => {
            if is_integer(v) && v.as_f64().is_some_and(|x| x >= 1.0) {
                Ok(())
            } else {
                fail(key, "must be a positive integer")
            }
        }
        "category" | "symmetry" => {
            if v.is_string() {
                Ok(())
            } else {
                fail(key, "must be a string")
            }
        }
        "names" => {
            if !v.is_object() {
                return fail(key, "must be an object");
            }
            if !get(v, "en").is_string() {
                return fail("names.en", "must be a string");
            }
            check_kurdish("names.ckb", get(v, "ckb"))?;
            check_kurdish("names.kmr", get(v, "kmr"))
        }
        "aliases" | "tags" => {
            if is_str_list(v) {
                Ok(())
            } else {
                fail(key, "must be a list of strings")
            }
        }
        "layers" => {
            let ok = v.as_array().is_some_and(|a| {
                !a.is_empty()
                    && a.iter()
                        .all(|x| x.as_str().is_some_and(|s| KEBAB.is_match(s)))
            });
            if ok {
                Ok(())
            } else {
                fail(key, "must be a non-empty list of kebab-case ids")
            }
        }
        "parameters" => {
            let Some(m) = v.as_object() else {
                return fail(key, "must be an object");
            };
            for (k, d) in m {
                check_parameter(&format!("{key}.{k}"), d)?;
            }
            Ok(())
        }
        _ => {
            let Some(list) = v.as_array().filter(|a| !a.is_empty()) else {
                return fail(key, "must be a non-empty list");
            };
            for (i, prim) in list.iter().enumerate() {
                check_primitive(&format!("{key}[{i}]"), prim, 0)?;
            }
            Ok(())
        }
    }
}

fn structure(x: &Value) -> std::result::Result<Shape, String> {
    let Some(m) = x.as_object() else {
        return Err("spec: must be a JSON object".to_owned());
    };
    for key in m.keys() {
        if !TOP.contains(&key.as_str()) && !DOC_FIELDS.contains(&key.as_str()) {
            return Err(format!("spec: unknown field \"{key}\""));
        }
    }
    for key in TOP {
        match m.get(key) {
            Some(v) => check_top(key, v)?,
            None if !OPTIONAL.contains(&key) => {
                return Err(format!("spec: missing field \"{key}\""));
            }
            None => {}
        }
    }
    Ok(json!({
        "id": m["id"],
        "version": m["version"],
        "category": m["category"],
        "names": m["names"],
        "aliases": m.get("aliases").cloned().unwrap_or_else(|| json!([])),
        "tags": m.get("tags").cloned().unwrap_or_else(|| json!([])),
        "layers": m["layers"],
        "symmetry": m.get("symmetry").cloned().unwrap_or_else(|| json!("none")),
        "parameters": m["parameters"],
        "primitives": m["primitives"],
    }))
}

/// Check the structure of parsed spec JSON and return it as shape data.
///
/// # Errors
/// `InvalidShape` naming the first problem.
pub fn check_spec(x: &Value) -> Result<Shape> {
    structure(x).map_err(|e| DeqError {
        code: ErrorCode::InvalidShape,
        message: e.clone(),
        issues: vec![e],
    })
}

/// The parameter overrides `validate` renders: the defaults, then each other value.
#[must_use]
#[allow(clippy::cast_possible_truncation)]
pub fn variants(shape: &Shape) -> Vec<Map<String, Value>> {
    let mut out = vec![Map::new()];
    for (name, p) in obj(shape, "parameters") {
        let values: Vec<Value> = match s(p, "type") {
            "integer" => {
                let (lo, hi) = (
                    get(p, "min").as_f64().unwrap_or(0.0),
                    get(p, "max").as_f64().unwrap_or(0.0),
                );
                if hi - lo > MAX_RANGE {
                    vec![get(p, "min").clone(), get(p, "max").clone()]
                } else {
                    (lo as i64..=hi as i64).map(Value::from).collect()
                }
            }
            "boolean" => vec![json!(true), json!(false)],
            _ => get(p, "values").as_array().cloned().unwrap_or_default(),
        };
        for v in values {
            if !js_equal(&v, get(p, "default")) {
                let mut m = Map::new();
                m.insert(name.clone(), v);
                out.push(m);
            }
        }
    }
    out
}

/// Validate parsed spec JSON; return `(id, variants rendered)`.
///
/// # Errors
/// `InvalidShape` for structural problems, or the renderer's error for a variant that fails.
pub fn validate_spec(json_value: &Value) -> Result<(String, usize)> {
    let shape = check_spec(json_value)?;
    let found = variants(&shape);
    for params in &found {
        prepare(&shape, &json!({ "params": params }))?;
    }
    Ok((s(&shape, "id").to_owned(), found.len()))
}
