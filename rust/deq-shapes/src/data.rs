//! The catalog data generated from `spec/` (`data/shapes.json`, ADR 0011).

use serde_json::Value;
use std::sync::LazyLock;

static DATA: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../data/shapes.json")).unwrap_or(Value::Null)
});

/// The parsed `shapes.json`: `{"flag": ..., "shapes": [...]}`.
#[must_use]
pub fn data() -> &'static Value {
    &DATA
}
