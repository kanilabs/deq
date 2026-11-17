//! Expand a shape (generators, conditions, references) into flat geometry.

use crate::error::{DeqError, ErrorCode, Result};
use crate::format::{is_integer, is_number, js_equal, js_json, js_str, js_to_fixed};
use crate::geometry::{self as g, Flat, Kind, Paint, Transform, Vec2};
use crate::json::{arr, f, get, obj, s, strs, vec2};
use crate::registry::{Shape, get_shape};
use serde_json::{Map, Value};

/// Deepest nesting of generators and references.
pub const MAX_DEPTH: usize = 6;
/// Most flat items one render may produce.
pub const MAX_FLAT: usize = 2000;

fn fail(where_: &str, message: &str) -> DeqError {
    DeqError::new(ErrorCode::InvalidParameter, format!("{where_}: {message}"))
}

/// Parameter defaults merged with `overrides`, type- and range-checked.
///
/// # Errors
/// `InvalidParameter` for unknown parameters or values of the wrong type or range.
pub fn resolve_params(
    shape: &Shape,
    overrides: Option<&Map<String, Value>>,
) -> Result<Map<String, Value>> {
    let id = s(shape, "id");
    let decls = obj(shape, "parameters");
    let mut values: Map<String, Value> = decls
        .iter()
        .map(|(n, d)| (n.clone(), get(d, "default").clone()))
        .collect();
    for (name, value) in overrides.into_iter().flatten() {
        if !decls.contains_key(name) {
            let known = if decls.is_empty() {
                "none".to_owned()
            } else {
                decls.keys().cloned().collect::<Vec<_>>().join(", ")
            };
            return Err(fail(
                id,
                &format!("unknown parameter \"{name}\" (known: {known})"),
            ));
        }
        values.insert(name.clone(), value.clone());
    }
    for (name, decl) in decls {
        let v = values.get(name).unwrap_or(&Value::Null);
        match s(decl, "type") {
            "integer" => {
                if !is_integer(v) {
                    return Err(fail(
                        id,
                        &format!("parameter \"{name}\" must be an integer"),
                    ));
                }
                let x = v.as_f64().unwrap_or(f64::NAN);
                if x < f(decl, "min") || x > f(decl, "max") {
                    return Err(fail(
                        id,
                        &format!(
                            "{name}={} is outside {}..{}",
                            js_str(v),
                            js_str(get(decl, "min")),
                            js_str(get(decl, "max"))
                        ),
                    ));
                }
            }
            "boolean" => {
                if !v.is_boolean() {
                    return Err(fail(
                        id,
                        &format!("parameter \"{name}\" must be true or false"),
                    ));
                }
            }
            _ => {
                let allowed = strs(decl, "values");
                if !v.as_str().is_some_and(|x| allowed.contains(&x)) {
                    return Err(fail(
                        id,
                        &format!("{name}={} is not one of {}", js_json(v), allowed.join(", ")),
                    ));
                }
            }
        }
    }
    Ok(values)
}

#[derive(Clone)]
struct Ctx<'a> {
    params: &'a Map<String, Value>,
    transform: Transform,
    layer: String,
    depth: usize,
    where_: String,
    stack: Vec<String>,
}

fn invalid(ctx: &Ctx<'_>, message: &str) -> DeqError {
    DeqError::new(
        ErrorCode::InvalidShape,
        format!("{}: {message}", ctx.where_),
    )
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn count(value: &Value, ctx: &Ctx<'_>) -> Result<usize> {
    let v = if is_number(value) {
        value
    } else {
        ctx.params.get(s(value, "param")).unwrap_or(&Value::Null)
    };
    match v.as_f64() {
        // A non-negative integer; the expansion limit stops huge counts.
        Some(x) if is_integer(v) && x >= 0.0 => Ok(x.min(1e9) as usize),
        _ => Err(invalid(ctx, "count must be a non-negative integer")),
    }
}

fn when_matches(prim: &Value, ctx: &Ctx<'_>) -> Result<bool> {
    for (name, expected) in obj(prim, "when") {
        let Some(actual) = ctx.params.get(name) else {
            return Err(invalid(
                ctx,
                &format!("`when` uses unknown parameter \"{name}\""),
            ));
        };
        let matches = match expected {
            Value::Array(options) => options.iter().any(|o| js_equal(o, actual)),
            o => js_equal(o, actual),
        };
        if !matches {
            return Ok(false);
        }
    }
    Ok(true)
}

fn child<'a>(ctx: &Ctx<'a>, t: &Transform) -> Ctx<'a> {
    Ctx {
        transform: g::chain(t, &ctx.transform),
        depth: ctx.depth + 1,
        where_: format!("{}.element", ctx.where_),
        ..ctx.clone()
    }
}

fn add(out: &mut Vec<Flat>, kind: Kind, paint: Paint, ctx: &Ctx<'_>) -> Result<()> {
    if out.len() >= MAX_FLAT {
        return Err(DeqError::new(
            ErrorCode::LimitExceeded,
            format!("{}: expands to more than {MAX_FLAT} items", ctx.where_),
        ));
    }
    out.push(g::transform_flat(
        Flat {
            kind,
            layer: ctx.layer.clone(),
            paint,
        },
        &ctx.transform,
    ));
    Ok(())
}

fn points(prim: &Value) -> Vec<Vec2> {
    arr(prim, "points").iter().map(vec2).collect()
}

#[allow(clippy::too_many_lines)] // One arm per primitive type, as in the reference.
fn expand_prim(prim: &Value, parent: &Ctx<'_>, out: &mut Vec<Flat>) -> Result<()> {
    if parent.depth > MAX_DEPTH {
        return Err(DeqError::new(
            ErrorCode::LimitExceeded,
            format!("{}: nested deeper than {MAX_DEPTH}", parent.where_),
        ));
    }
    if !when_matches(prim, parent)? {
        return Ok(());
    }
    let own = s(prim, "layer");
    let layer = if own.is_empty() {
        parent.layer.clone()
    } else {
        own.to_owned()
    };
    if layer.is_empty() {
        return Err(invalid(parent, "no layer"));
    }
    let ctx = Ctx {
        layer,
        ..parent.clone()
    };
    let paint = if s(prim, "paint") == "fill" {
        Paint::Fill
    } else {
        Paint::Stroke
    };
    let n = |key: &str| f(prim, key);
    match s(prim, "type") {
        "line" => {
            let pts = vec![(n("x1"), n("y1")), (n("x2"), n("y2"))];
            add(
                out,
                Kind::Poly {
                    points: pts,
                    closed: false,
                },
                Paint::Stroke,
                &ctx,
            )?;
        }
        "polyline" => add(
            out,
            Kind::Poly {
                points: points(prim),
                closed: false,
            },
            Paint::Stroke,
            &ctx,
        )?,
        "polygon" => add(
            out,
            Kind::Poly {
                points: points(prim),
                closed: true,
            },
            paint,
            &ctx,
        )?,
        "rect" => {
            let (x, y, w, h) = (n("x"), n("y"), n("width"), n("height"));
            let pts = vec![(x, y), (x + w, y), (x + w, y + h), (x, y + h)];
            add(
                out,
                Kind::Poly {
                    points: pts,
                    closed: true,
                },
                paint,
                &ctx,
            )?;
        }
        "star" => {
            let k = count(get(prim, "points"), &ctx)?;
            if k < 2 {
                return Err(invalid(&ctx, "a star needs at least 2 points"));
            }
            let k = u32::try_from(k).unwrap_or(u32::MAX / 2);
            let star = g::star_points(
                n("cx"),
                n("cy"),
                k,
                n("outerRadius"),
                n("innerRadius"),
                n("rotation"),
            );
            add(
                out,
                Kind::Poly {
                    points: star,
                    closed: true,
                },
                paint,
                &ctx,
            )?;
        }
        "circle" => add(
            out,
            Kind::Circle {
                cx: n("cx"),
                cy: n("cy"),
                r: n("r"),
                dot: false,
            },
            paint,
            &ctx,
        )?,
        "dot" => {
            let r = get(prim, "r").as_f64().unwrap_or(1.0);
            add(
                out,
                Kind::Circle {
                    cx: n("cx"),
                    cy: n("cy"),
                    r,
                    dot: true,
                },
                Paint::Fill,
                &ctx,
            )?;
        }
        "arc" => {
            let (start, end) = (n("start"), n("end"));
            if !(start < end && end <= start + 360.0) {
                return Err(invalid(&ctx, "arc needs start < end <= start + 360"));
            }
            add(
                out,
                Kind::Arc {
                    cx: n("cx"),
                    cy: n("cy"),
                    r: n("r"),
                    start,
                    end,
                },
                Paint::Stroke,
                &ctx,
            )?;
        }
        "ellipse" => {
            let kind = Kind::Ellipse {
                cx: n("cx"),
                cy: n("cy"),
                rx: n("rx"),
                ry: n("ry"),
                rotation: 0.0,
            };
            add(out, kind, paint, &ctx)?;
        }
        "path" => add(
            out,
            Kind::Path {
                segments: g::parse_path(s(prim, "d"))?,
            },
            paint,
            &ctx,
        )?,
        "radial" => {
            let k = count(get(prim, "count"), &ctx)?;
            let sweep = n("sweep");
            #[allow(clippy::cast_precision_loss)]
            let kf = k as f64;
            let step = if k > 1 {
                if sweep >= 360.0 {
                    sweep / kf
                } else {
                    sweep / (kf - 1.0)
                }
            } else {
                0.0
            };
            let center = vec2(get(prim, "center"));
            for i in 0..k {
                #[allow(clippy::cast_precision_loss)]
                let t = g::rotate(n("start") + i as f64 * step, center);
                expand_prim(get(prim, "element"), &child(&ctx, &t), out)?;
            }
        }
        "repeat" => {
            let k = count(get(prim, "count"), &ctx)?;
            #[allow(clippy::cast_precision_loss)]
            let kf = k as f64;
            let (mut dx, mut dy) = (0.0, 0.0);
            if !get(prim, "step").is_null() {
                (dx, dy) = vec2(get(prim, "step"));
            } else if !get(prim, "spread").is_null() {
                if k > 1 {
                    let (sx, sy) = vec2(get(prim, "spread"));
                    (dx, dy) = (sx / (kf - 1.0), sy / (kf - 1.0));
                }
            } else {
                return Err(invalid(&ctx, "repeat needs step or spread"));
            }
            let c = if matches!(s(prim, "align"), "center" | "") {
                (kf - 1.0) / 2.0
            } else {
                0.0
            };
            for i in 0..k {
                #[allow(clippy::cast_precision_loss)]
                let fi = i as f64;
                let t = g::translate((fi - c) * dx, (fi - c) * dy);
                expand_prim(get(prim, "element"), &child(&ctx, &t), out)?;
            }
        }
        "concentric" => {
            let k = count(get(prim, "count"), &ctx)?;
            for i in 0..k {
                #[allow(clippy::cast_precision_loss)]
                let sc = 1.0 - i as f64 * n("scaleStep");
                if sc <= 0.0 {
                    return Err(invalid(
                        &ctx,
                        &format!("copy {i} would have scale {}", js_to_fixed(sc, 3)),
                    ));
                }
                let t = g::scale(sc, vec2(get(prim, "center")));
                expand_prim(get(prim, "element"), &child(&ctx, &t), out)?;
            }
        }
        "use" => expand_use(prim, &ctx, out)?,
        _ => {}
    }
    Ok(())
}

/// The placement transform of a `use`.
#[must_use]
pub fn use_transform(prim: &Value) -> Transform {
    let tr = get(prim, "transform");
    let origin = if get(tr, "origin").is_null() {
        (12.0, 12.0)
    } else {
        vec2(get(tr, "origin"))
    };
    let mut t = g::scale(get(tr, "scale").as_f64().unwrap_or(1.0), origin);
    let rot = get(tr, "rotate").as_f64().unwrap_or(0.0);
    if rot != 0.0 {
        t = g::chain(&t, &g::rotate(rot, origin));
    }
    let (dx, dy) = if get(tr, "translate").is_null() {
        (0.0, 0.0)
    } else {
        vec2(get(tr, "translate"))
    };
    g::chain(&t, &g::translate(dx, dy))
}

fn expand_use(prim: &Value, ctx: &Ctx<'_>, out: &mut Vec<Flat>) -> Result<()> {
    let target_id = s(prim, "shape");
    if ctx.stack.iter().any(|x| x == target_id) {
        let mut chain = ctx.stack.clone();
        chain.push(target_id.to_owned());
        return Err(invalid(
            ctx,
            &format!("reference cycle {}", chain.join(" -> ")),
        ));
    }
    let target = get_shape(target_id)?;
    let params = resolve_params(target, get(prim, "params").as_object())?;
    let t = g::chain(&use_transform(prim), &ctx.transform);
    let id = s(target, "id");
    for (i, sub) in arr(target, "primitives").iter().enumerate() {
        let before = out.len();
        let mut stack = ctx.stack.clone();
        stack.push(id.to_owned());
        let sub_ctx = Ctx {
            params: &params,
            transform: t,
            layer: ctx.layer.clone(),
            depth: ctx.depth + 1,
            where_: format!("{}->{id}[{i}]", ctx.where_),
            stack,
        };
        expand_prim(sub, &sub_ctx, out)?;
        // Every part of a referenced shape lands in the layer of the `use`.
        for item in &mut out[before..] {
            item.layer.clone_from(&ctx.layer);
        }
    }
    Ok(())
}

/// Expand `shape` into flat geometry with the given parameter values.
///
/// # Errors
/// `InvalidParameter`, `InvalidShape`, `UnknownShape` or `LimitExceeded`.
pub fn expand_shape(shape: &Shape, params: Option<&Map<String, Value>>) -> Result<Vec<Flat>> {
    let values = resolve_params(shape, params)?;
    let id = s(shape, "id");
    let mut out = Vec::new();
    for (i, prim) in arr(shape, "primitives").iter().enumerate() {
        let ctx = Ctx {
            params: &values,
            transform: g::IDENTITY,
            layer: s(prim, "layer").to_owned(),
            depth: 0,
            where_: format!("{id}.primitives[{i}]"),
            stack: vec![id.to_owned()],
        };
        expand_prim(prim, &ctx, &mut out)?;
    }
    Ok(out)
}

/// Expand the catalog shape `shape_id` into flat geometry.
///
/// # Errors
/// As [`expand_shape`], plus `UnknownShape`.
pub fn expand(shape_id: &str, params: Option<&Map<String, Value>>) -> Result<Vec<Flat>> {
    expand_shape(get_shape(shape_id)?, params)
}
