//! Seeded pattern generator: bands, grids, rosettes and borders of Deq motifs (ADR 0015).

use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value, json};

use crate::error::{DeqError, Result};
use crate::geometry::cos_sin;
use crate::leet::{Check, integer, seed_check, split_options, to_seed, to_usize};
use crate::options::{number, picklist};
use crate::pattern::compile;
use crate::random::Random;
use crate::registry::{get_shape, list_shapes};
use crate::scene::{Cell, Scene, resolve_scene_options, scene_svg};

static ID: LazyLock<Regex> = LazyLock::new(|| compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"));

fn motifs_check(v: &Value) -> Option<String> {
    let ok = v.as_array().is_some_and(|ids| {
        (1..=64).contains(&ids.len())
            && ids.iter().all(|id| {
                id.as_str()
                    .is_some_and(|s| s.chars().count() <= 64 && ID.is_match(s))
            })
    });
    (!ok).then(|| "must be a list of 1 to 64 shape ids".to_owned())
}

fn count_check(v: &Value) -> Option<String> {
    integer(v, 3.0, 63.0)
        .or_else(|| (v.as_f64().unwrap_or(0.0) % 2.0 != 1.0).then(|| "must be odd".to_owned()))
}

const CHECKS: [(&str, Check); 8] = [
    ("kind", |v| {
        picklist(v, &["band", "grid", "rosette", "border"])
    }),
    ("seed", seed_check),
    ("motifs", motifs_check),
    ("count", count_check),
    ("cols", |v| integer(v, 1.0, 32.0)),
    ("rows", |v| integer(v, 1.0, 32.0)),
    ("petals", |v| integer(v, 3.0, 24.0)),
    ("spacing", |v| number(v, 0.0, 24.0, false)),
];

/// The result of [`pattern`].
#[derive(Debug, Clone, PartialEq)]
pub struct PatternResult {
    /// The SVG document, one `<g data-layer="cN">` per motif.
    pub svg: String,
    /// The motifs chosen, in the order the pattern uses them.
    pub motifs: Vec<String>,
    /// The placed motifs.
    pub scene: Scene,
}

/// `count` distinct motifs from `pool` (repeating only when the pool is smaller).
fn choose(pool: &[String], count: usize, random: &mut Random) -> Vec<String> {
    let mut left: Vec<String> = pool.to_vec();
    let mut out = Vec::with_capacity(count);
    for _ in 0..count {
        if left.is_empty() {
            left.extend_from_slice(pool);
        }
        let i = random.below(left.len());
        if i < left.len() {
            out.push(left.remove(i));
        }
    }
    out
}

fn nth(items: &[String], i: usize) -> String {
    items
        .get(i % items.len().max(1))
        .cloned()
        .unwrap_or_default()
}

fn cell(x: f64, y: f64, shape: &str, rotate: f64, scale: f64) -> Cell {
    let mut part = Map::new();
    part.insert("shape".into(), json!(shape));
    if rotate != 0.0 || scale != 1.0 {
        let mut transform = Map::new();
        if scale != 1.0 {
            transform.insert("scale".into(), json!(scale));
        }
        if rotate != 0.0 {
            transform.insert("rotate".into(), json!(rotate));
        }
        part.insert("transform".into(), Value::Object(transform));
    }
    Cell {
        x,
        y,
        glyph: Value::Array(vec![Value::Object(part)]),
    }
}

/// Generate a pattern of Deq motifs.
///
/// `band` repeats motifs in a row (alternating or mirrored), `grid` lays a checkerboard,
/// `rosette` rings petals round a centre and `border` frames a rectangle. Options are
/// `kind`, `seed`, `motifs`, `count`, `cols`, `rows`, `petals`, `spacing`, `colors` and the
/// render options except the per-shape ones.
///
/// # Errors
/// `InvalidOptions`, `UnknownShape` or `LimitExceeded`.
#[allow(clippy::cast_precision_loss, clippy::too_many_lines)]
pub fn pattern(options: &Value) -> Result<PatternResult> {
    let (own, scene) = split_options(options, &CHECKS, "pattern options")?;
    resolve_scene_options(&scene)?;
    let pool: Vec<String> = match own.get("motifs").and_then(Value::as_array) {
        Some(ids) => ids
            .iter()
            .filter_map(|v| v.as_str().map(str::to_owned))
            .collect(),
        None => list_shapes(None)
            .iter()
            .filter_map(|s| s["id"].as_str().map(str::to_owned))
            .collect(),
    };
    for id in &pool {
        get_shape(id)?;
    }
    let int = |key: &str, default: usize| {
        own.get(key)
            .and_then(Value::as_f64)
            .map_or(default, to_usize)
    };
    let mut random = Random::new(to_seed(own.get("seed")));
    let step = 24.0 + own.get("spacing").and_then(Value::as_f64).unwrap_or(2.0);
    let kind = own.get("kind").and_then(Value::as_str).unwrap_or("band");
    let mut cells = Vec::new();
    let used: Vec<String>;
    let (width, height);
    match kind {
        "band" => {
            let n = int("count", 9);
            let mirror = random.below(2) == 1;
            used = choose(&pool, if mirror { 3 } else { 2 }, &mut random);
            for i in 0..n {
                let j = if mirror { i.min(n - 1 - i) } else { i };
                cells.push(cell(i as f64 * step, 0.0, &nth(&used, j), 0.0, 1.0));
            }
            width = n as f64 * step - (step - 24.0);
            height = 24.0;
        }
        "grid" => {
            let (c, r) = (int("cols", 5), int("rows", 5));
            used = choose(&pool, 2, &mut random);
            for y in 0..r {
                for x in 0..c {
                    let shape = nth(&used, x + y);
                    cells.push(cell(x as f64 * step, y as f64 * step, &shape, 0.0, 1.0));
                }
            }
            width = c as f64 * step - (step - 24.0);
            height = r as f64 * step - (step - 24.0);
        }
        "rosette" => {
            let n = int("petals", 8);
            used = choose(&pool, 2, &mut random);
            cells.push(cell(step, step, &nth(&used, 0), 0.0, 1.0));
            let petal = nth(&used, 1);
            for i in 0..n {
                let angle = (360.0 * i as f64) / n as f64;
                let (c, s) = cos_sin(angle);
                cells.push(cell(step + step * s, step - step * c, &petal, angle, 0.75));
            }
            width = 2.0 * step + 24.0;
            height = width;
        }
        _ => {
            let (c, r) = (int("cols", 7), int("rows", 3));
            if c < 3 || r < 3 {
                let issue = "cols, rows: a border needs at least 3 x 3 cells".to_owned();
                return Err(DeqError::options("invalid pattern options", vec![issue]));
            }
            used = choose(&pool, 2, &mut random);
            let (corner, edge) = (nth(&used, 0), nth(&used, 1));
            let right = (c - 1) as f64 * step;
            let bottom = (r - 1) as f64 * step;
            for x in 0..c {
                let end = x == 0 || x == c - 1;
                let turn = if end && x > 0 { 90.0 } else { 0.0 };
                let shape = if end { &corner } else { &edge };
                cells.push(cell(x as f64 * step, 0.0, shape, turn, 1.0));
            }
            for y in 1..r - 1 {
                cells.push(cell(right, y as f64 * step, &edge, 90.0, 1.0));
            }
            for x in (0..c).rev() {
                let end = x == 0 || x == c - 1;
                let turn = match (end, x > 0) {
                    (true, true) | (false, _) => 180.0,
                    (true, false) => 270.0,
                };
                let shape = if end { &corner } else { &edge };
                cells.push(cell(x as f64 * step, bottom, shape, turn, 1.0));
            }
            for y in (1..r - 1).rev() {
                cells.push(cell(0.0, y as f64 * step, &edge, 270.0, 1.0));
            }
            width = right + 24.0;
            height = bottom + 24.0;
        }
    }
    let placed = Scene {
        width,
        height,
        cells,
    };
    let svg = scene_svg(&placed, &scene, &format!("Deq {kind} pattern"), "")?;
    Ok(PatternResult {
        svg,
        motifs: used,
        scene: placed,
    })
}
