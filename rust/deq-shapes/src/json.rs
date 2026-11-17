//! Small accessors for JSON shape data that is already validated.
//!
//! Catalog data is checked when it is generated and user specs by `validate::check_spec`, so
//! missing fields only fall back to neutral values instead of panicking.

use serde_json::{Map, Value};

static EMPTY: std::sync::LazyLock<Map<String, Value>> = std::sync::LazyLock::new(Map::new);

/// The field `key` of an object, or `null`.
#[must_use]
pub fn get<'a>(v: &'a Value, key: &str) -> &'a Value {
    v.get(key).unwrap_or(&Value::Null)
}

/// The number at `key`, or NaN.
#[must_use]
pub fn f(v: &Value, key: &str) -> f64 {
    get(v, key).as_f64().unwrap_or(f64::NAN)
}

/// The string at `key`, or "".
#[must_use]
pub fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    get(v, key).as_str().unwrap_or("")
}

/// The object at `key`, or an empty one.
#[must_use]
pub fn obj<'a>(v: &'a Value, key: &str) -> &'a Map<String, Value> {
    get(v, key).as_object().unwrap_or(&EMPTY)
}

/// The array at `key`, or an empty one.
#[must_use]
pub fn arr<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    get(v, key).as_array().map_or(&[], Vec::as_slice)
}

/// The strings of the array at `key`.
#[must_use]
pub fn strs<'a>(v: &'a Value, key: &str) -> Vec<&'a str> {
    arr(v, key).iter().filter_map(Value::as_str).collect()
}

/// An `[x, y]` pair, or `(NaN, NaN)`.
#[must_use]
pub fn vec2(v: &Value) -> (f64, f64) {
    let n = |i: usize| v.get(i).and_then(Value::as_f64).unwrap_or(f64::NAN);
    (n(0), n(1))
}
