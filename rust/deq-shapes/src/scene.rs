//! Scenes: glyphs placed on a canvas larger than one shape (ADR 0015).
//!
//! A scene is written as one SVG with one group (layer) per cell. Leet text and generated
//! patterns are both scenes.

use std::collections::HashMap;

use serde_json::{Map, Value, json};

use crate::error::{DeqError, ErrorCode, Result};
use crate::expand::expand_shape;
use crate::format::{escape_xml, num};
use crate::geometry::Flat;
use crate::options::{ResolvedOptions, resolve_options};
use crate::svg::{element, svg_root};

/// The most drawing elements one scene may expand to.
pub const MAX_SCENE_ITEMS: usize = 20_000;

const SHAPE_ONLY: [&str; 5] = ["rotation", "flipX", "flipY", "params", "layerColors"];
const SCENE: &str = "invalid scene options";

/// One glyph placed in a scene; its 24 x 24 cell has its top left at (x, y).
///
/// A glyph is a JSON list of parts `{"shape", "params"?, "transform"?}`.
#[derive(Debug, Clone, PartialEq)]
pub struct Cell {
    /// Left edge in grid units.
    pub x: f64,
    /// Top edge in grid units.
    pub y: f64,
    /// The glyph's parts.
    pub glyph: Value,
}

/// Glyphs on a `width` x `height` canvas in grid units.
#[derive(Debug, Clone, PartialEq)]
pub struct Scene {
    /// Width in grid units.
    pub width: f64,
    /// Height in grid units.
    pub height: f64,
    /// The placed glyphs, in layer order.
    pub cells: Vec<Cell>,
}

/// Validated scene options.
#[derive(Debug, Clone)]
pub struct ResolvedSceneOptions {
    /// The render options.
    pub render: ResolvedOptions,
    /// Colours given to the cells in turn (empty for none).
    pub colors: Vec<String>,
}

/// Validate scene options: render options without the per-shape ones, plus `colors`.
///
/// # Errors
/// `InvalidOptions`.
pub fn resolve_scene_options(options: &Value) -> Result<ResolvedSceneOptions> {
    let Value::Object(map) = options else {
        let render = resolve_options(options)?;
        return Ok(ResolvedSceneOptions {
            render,
            colors: Vec::new(),
        });
    };
    let mut rest = map.clone();
    let colors = rest.shift_remove("colors");
    let bad: Vec<String> = SHAPE_ONLY
        .iter()
        .filter(|k| rest.contains_key(**k))
        .map(|k| format!("{k}: not available for scenes"))
        .collect();
    if !bad.is_empty() {
        return Err(DeqError::options(SCENE, bad));
    }
    let render = resolve_options(&Value::Object(rest))?;
    let Some(colors) = colors else {
        return Ok(ResolvedSceneOptions {
            render,
            colors: Vec::new(),
        });
    };
    let list: Option<Vec<String>> = colors.as_array().and_then(|items| {
        items
            .iter()
            .map(|c| c.as_str().map(str::to_owned))
            .collect()
    });
    let Some(list) = list.filter(|l| (1..=16).contains(&l.len())) else {
        let issue = "colors: must be a list of 1 to 16 colours".to_owned();
        return Err(DeqError::options(SCENE, vec![issue]));
    };
    for (i, c) in list.iter().enumerate() {
        if resolve_options(&json!({ "color": c })).is_err() {
            let issue = format!("colors.{i}: must be a CSS colour");
            return Err(DeqError::options(SCENE, vec![issue]));
        }
    }
    Ok(ResolvedSceneOptions {
        render,
        colors: list,
    })
}

/// The shape description of a glyph: one `use` primitive per part.
#[must_use]
pub fn glyph_shape(glyph: &Value) -> Value {
    let primitives: Vec<Value> = glyph
        .as_array()
        .map(|parts| {
            parts
                .iter()
                .map(|part| {
                    let mut prim = Map::new();
                    prim.insert("type".into(), json!("use"));
                    prim.insert(
                        "shape".into(),
                        part.get("shape").cloned().unwrap_or(Value::Null),
                    );
                    prim.insert("layer".into(), json!("glyph"));
                    for key in ["params", "transform"] {
                        if let Some(v) = part.get(key) {
                            prim.insert(key.into(), v.clone());
                        }
                    }
                    Value::Object(prim)
                })
                .collect()
        })
        .unwrap_or_default();
    json!({
        "id": "glyph",
        "version": 1,
        "category": "glyph",
        "names": {
            "en": "Glyph",
            "ckb": { "text": null, "status": "none" },
            "kmr": { "text": null, "status": "none" }
        },
        "aliases": [],
        "tags": [],
        "layers": ["glyph"],
        "symmetry": "none",
        "parameters": {},
        "primitives": primitives
    })
}

/// The flat geometry of a glyph in its own 24 x 24 cell.
///
/// # Errors
/// Every error of [`expand_shape`].
pub fn expand_glyph(glyph: &Value) -> Result<Vec<Flat>> {
    expand_shape(&glyph_shape(glyph), Some(&Map::new()))
}

/// The inner markup of a glyph's group, as written by [`scene_svg`].
///
/// # Errors
/// Every error of [`expand_shape`].
pub fn glyph_markup(glyph: &Value, o: &ResolvedOptions) -> Result<String> {
    Ok(expand_glyph(glyph)?
        .iter()
        .map(|item| element(item, o))
        .collect())
}

/// Write `scene` as SVG, one `<g data-layer="cN" transform="translate(x y)">` per cell.
///
/// # Errors
/// `InvalidOptions`, the errors of [`expand_shape`], or `LimitExceeded` (more than
/// [`MAX_SCENE_ITEMS`] elements).
pub fn scene_svg(scene: &Scene, options: &Value, title: &str, root_attrs: &str) -> Result<String> {
    let ResolvedSceneOptions { render: o, colors } = resolve_scene_options(options)?;
    let mut cache: HashMap<String, Vec<Flat>> = HashMap::new();
    let mut count = 0usize;
    let mut out = svg_root(&o, title, root_attrs, scene.width, scene.height);
    for (i, cell) in scene.cells.iter().enumerate() {
        let key = cell.glyph.to_string();
        if !cache.contains_key(&key) {
            cache.insert(key.clone(), expand_glyph(&cell.glyph)?);
        }
        let items = cache.get(&key).map_or(&[][..], Vec::as_slice);
        count += items.len();
        if count > MAX_SCENE_ITEMS {
            return Err(DeqError::new(
                ErrorCode::LimitExceeded,
                format!("scene expands to more than {MAX_SCENE_ITEMS} elements"),
            ));
        }
        let style = colors
            .get(i % colors.len().max(1))
            .map_or_else(String::new, |c| {
                format!(" color=\"{}\" stroke=\"currentColor\"", escape_xml(c))
            });
        let inner: String = items.iter().map(|item| element(item, &o)).collect();
        out.push_str(&format!(
            "<g data-layer=\"c{}\" transform=\"translate({} {})\"{style}>{inner}</g>",
            i + 1,
            num(cell.x),
            num(cell.y)
        ));
    }
    out.push_str("</svg>");
    Ok(out)
}
