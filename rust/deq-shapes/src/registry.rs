//! The shape catalog: lookup with "did you mean" hints, listing and categories.

use crate::data::data;
use crate::error::{DeqError, ErrorCode, Result};
use crate::format::{json_string, take_chars};
use crate::json::{arr, s, strs};
use serde_json::Value;

/// A shape description (`spec/shapes/<id>.json` without documentation fields).
pub type Shape = Value;

fn shapes() -> &'static [Shape] {
    arr(data(), "shapes")
}

fn distance(a: &[char], b: &[char]) -> usize {
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut row = vec![i];
        for j in 1..=b.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            row.push((prev[j] + 1).min(row[j - 1] + 1).min(prev[j - 1] + cost));
        }
        prev = row;
    }
    prev[b.len()]
}

/// Up to 3 known ids close to `shape_id` (also matching aliases and substrings).
#[must_use]
pub fn suggest(shape_id: &str) -> Vec<String> {
    let q = shape_id.to_lowercase();
    let qc: Vec<char> = q.chars().collect();
    let mut scored: Vec<(usize, &str)> = shapes()
        .iter()
        .map(|sh| {
            let id = s(sh, "id");
            let best = std::iter::once(id)
                .chain(strs(sh, "aliases"))
                .map(|n| {
                    if n.contains(&q) {
                        0
                    } else {
                        distance(&qc, &n.chars().collect::<Vec<_>>())
                    }
                })
                .min()
                .unwrap_or(usize::MAX);
            (best, id)
        })
        .collect();
    let limit = (qc.len() / 3).max(2);
    scored.retain(|x| x.0 <= limit);
    scored.sort_unstable();
    scored
        .into_iter()
        .take(3)
        .map(|(_, id)| id.to_owned())
        .collect()
}

/// The shape with this id; `UnknownShape` with suggestions otherwise.
///
/// # Errors
/// `UnknownShape` when no shape has this id.
pub fn get_shape(shape_id: &str) -> Result<&'static Shape> {
    if let Some(sh) = shapes().iter().find(|sh| s(sh, "id") == shape_id) {
        return Ok(sh);
    }
    let cut = take_chars(shape_id, 64);
    let hints = suggest(&cut);
    let hint = if hints.is_empty() {
        String::new()
    } else {
        format!(" Did you mean {}?", hints.join(", "))
    };
    Err(DeqError::new(
        ErrorCode::UnknownShape,
        format!(
            "unknown shape {}.{hint} See listShapes().",
            json_string(&cut)
        ),
    ))
}

/// Whether the catalog has a shape with this id.
#[must_use]
pub fn has_shape(shape_id: &str) -> bool {
    shapes().iter().any(|sh| s(sh, "id") == shape_id)
}

/// Every shape in catalog order, optionally only one category.
#[must_use]
pub fn list_shapes(category: Option<&str>) -> Vec<&'static Shape> {
    shapes()
        .iter()
        .filter(|sh| category.is_none_or(|c| s(sh, "category") == c))
        .collect()
}

/// Category ids in catalog order.
#[must_use]
pub fn list_categories() -> Vec<&'static str> {
    let mut out: Vec<&str> = Vec::new();
    for sh in shapes() {
        let c = s(sh, "category");
        if !out.contains(&c) {
            out.push(c);
        }
    }
    out
}
