//! Flat geometry: what a shape expands to, plus similarity transforms and path parsing.

use crate::error::{DeqError, ErrorCode, Result};
use crate::format::{js_mod, json_string};
use crate::pattern::compile;
use regex::Regex;
use std::sync::LazyLock;

/// A point.
pub type Vec2 = (f64, f64);

/// `p' = [a c e; b d f] p`, with the uniform scale and rotation angle it contains.
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct Transform {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub e: f64,
    pub f: f64,
    pub scale: f64,
    pub angle: f64,
}

/// The identity transform.
pub const IDENTITY: Transform = Transform {
    a: 1.0,
    b: 0.0,
    c: 0.0,
    d: 1.0,
    e: 0.0,
    f: 0.0,
    scale: 1.0,
    angle: 0.0,
};

/// Apply `t` to a point.
#[must_use]
pub fn apply(t: &Transform, p: Vec2) -> Vec2 {
    (t.a * p.0 + t.c * p.1 + t.e, t.b * p.0 + t.d * p.1 + t.f)
}

/// The transform that applies `inner` first, then `outer`.
#[must_use]
pub fn chain(inner: &Transform, outer: &Transform) -> Transform {
    let (o, s) = (outer, inner);
    Transform {
        a: o.a * s.a + o.c * s.b,
        b: o.b * s.a + o.d * s.b,
        c: o.a * s.c + o.c * s.d,
        d: o.b * s.c + o.d * s.d,
        e: o.a * s.e + o.c * s.f + o.e,
        f: o.b * s.e + o.d * s.f + o.f,
        scale: s.scale * o.scale,
        angle: s.angle + o.angle,
    }
}

/// A translation.
#[must_use]
pub fn translate(dx: f64, dy: f64) -> Transform {
    Transform {
        e: dx,
        f: dy,
        ..IDENTITY
    }
}

/// Cosine and sine of `deg` degrees, exact at multiples of 90.
#[must_use]
pub fn cos_sin(deg: f64) -> Vec2 {
    let m = js_mod(js_mod(deg, 360.0) + 360.0, 360.0);
    if m == 0.0 {
        (1.0, 0.0)
    } else if m == 90.0 {
        (0.0, 1.0)
    } else if m == 180.0 {
        (-1.0, 0.0)
    } else if m == 270.0 {
        (0.0, -1.0)
    } else {
        let t = (deg * std::f64::consts::PI) / 180.0;
        (t.cos(), t.sin())
    }
}

/// Rotate clockwise on screen (y points down) by `deg` about `center`.
#[must_use]
pub fn rotate(deg: f64, center: Vec2) -> Transform {
    let (cos, sin) = cos_sin(deg);
    let (cx, cy) = center;
    Transform {
        a: cos,
        b: sin,
        c: -sin,
        d: cos,
        e: cx - cos * cx + sin * cy,
        f: cy - sin * cx - cos * cy,
        scale: 1.0,
        angle: deg,
    }
}

/// Scale by `s` about `center`.
#[must_use]
pub fn scale(s: f64, center: Vec2) -> Transform {
    let (cx, cy) = center;
    Transform {
        a: s,
        d: s,
        e: cx - s * cx,
        f: cy - s * cy,
        scale: s,
        ..IDENTITY
    }
}

/// How an item is painted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Paint {
    /// Outlined with the stroke.
    Stroke,
    /// A solid area in the ink colour.
    Fill,
}

/// A path segment with absolute points.
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub enum Segment {
    M(Vec2),
    L(Vec2),
    Q(Vec2, Vec2),
    C(Vec2, Vec2, Vec2),
    Z,
}

impl Segment {
    /// The command letter.
    #[must_use]
    pub fn command(&self) -> char {
        match self {
            Self::M(_) => 'M',
            Self::L(_) => 'L',
            Self::Q(..) => 'Q',
            Self::C(..) => 'C',
            Self::Z => 'Z',
        }
    }

    /// The points of the segment.
    #[must_use]
    pub fn points(&self) -> Vec<Vec2> {
        match *self {
            Self::M(p) | Self::L(p) => vec![p],
            Self::Q(c, p) => vec![c, p],
            Self::C(c1, c2, p) => vec![c1, c2, p],
            Self::Z => Vec::new(),
        }
    }

    fn map(&self, t: &Transform) -> Self {
        match *self {
            Self::M(p) => Self::M(apply(t, p)),
            Self::L(p) => Self::L(apply(t, p)),
            Self::Q(c, p) => Self::Q(apply(t, c), apply(t, p)),
            Self::C(c1, c2, p) => Self::C(apply(t, c1), apply(t, c2), apply(t, p)),
            Self::Z => Self::Z,
        }
    }
}

/// The geometry of a flat item.
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum Kind {
    /// A line, polyline or polygon.
    Poly {
        points: Vec<Vec2>,
        closed: bool,
    },
    /// A circle; `dot` circles are filled and keep their radius under scaling.
    Circle {
        cx: f64,
        cy: f64,
        r: f64,
        dot: bool,
    },
    Arc {
        cx: f64,
        cy: f64,
        r: f64,
        start: f64,
        end: f64,
    },
    Ellipse {
        cx: f64,
        cy: f64,
        rx: f64,
        ry: f64,
        rotation: f64,
    },
    Path {
        segments: Vec<Segment>,
    },
}

/// One drawable item in canvas units.
#[derive(Debug, Clone, PartialEq)]
pub struct Flat {
    /// The geometry.
    pub kind: Kind,
    /// The layer id.
    pub layer: String,
    /// How it is painted.
    pub paint: Paint,
}

static PATH_TOKEN: LazyLock<Regex> =
    LazyLock::new(|| compile(r"[MLHVCQZ]|-?(?:[0-9]+\.?[0-9]*|\.[0-9]+)"));

fn arity(cmd: &str) -> Option<usize> {
    match cmd {
        "M" | "L" => Some(2),
        "H" | "V" => Some(1),
        "Q" => Some(4),
        "C" => Some(6),
        "Z" => Some(0),
        _ => None,
    }
}

/// Parse absolute `M L H V C Q Z` path data into segments with explicit points.
///
/// # Errors
/// `InvalidShape` for anything else.
pub fn parse_path(d: &str) -> Result<Vec<Segment>> {
    let tokens: Vec<&str> = PATH_TOKEN.find_iter(d).map(|m| m.as_str()).collect();
    let squeezed: String = d.chars().filter(|c| !c.is_whitespace()).collect();
    if tokens.concat() != squeezed || tokens.first() != Some(&"M") {
        return Err(DeqError::new(
            ErrorCode::InvalidShape,
            format!("unsupported path data: {}", json_string(d)),
        ));
    }
    let mut out = Vec::new();
    let mut cur: Vec2 = (0.0, 0.0);
    let mut start = cur;
    let mut i = 0;
    while i < tokens.len() {
        let cmd = tokens[i];
        let Some(n) = arity(cmd) else {
            return Err(DeqError::new(
                ErrorCode::InvalidShape,
                format!("expected a path command at token {i}"),
            ));
        };
        let raw = &tokens[i + 1..(i + 1 + n).min(tokens.len())];
        if raw.len() != n || raw.iter().any(|t| arity(t).is_some()) {
            return Err(DeqError::new(
                ErrorCode::InvalidShape,
                format!("{cmd} needs {n} numbers"),
            ));
        }
        let v: Vec<f64> = raw
            .iter()
            .map(|t| t.parse::<f64>().unwrap_or(f64::NAN))
            .collect();
        i += 1 + n;
        let seg = match cmd {
            "M" => {
                cur = (v[0], v[1]);
                start = cur;
                Segment::M(cur)
            }
            "L" => {
                cur = (v[0], v[1]);
                Segment::L(cur)
            }
            "H" => {
                cur = (v[0], cur.1);
                Segment::L(cur)
            }
            "V" => {
                cur = (cur.0, v[0]);
                Segment::L(cur)
            }
            "Q" => {
                cur = (v[2], v[3]);
                Segment::Q((v[0], v[1]), cur)
            }
            "C" => {
                cur = (v[4], v[5]);
                Segment::C((v[0], v[1]), (v[2], v[3]), cur)
            }
            _ => {
                cur = start;
                Segment::Z
            }
        };
        out.push(seg);
    }
    Ok(out)
}

/// Apply a similarity transform; dot radii and stroke widths stay unscaled.
#[must_use]
pub fn transform_flat(item: Flat, t: &Transform) -> Flat {
    let kind = match item.kind {
        Kind::Poly { points, closed } => Kind::Poly {
            points: points.into_iter().map(|p| apply(t, p)).collect(),
            closed,
        },
        Kind::Circle { cx, cy, r, dot } => {
            let (cx, cy) = apply(t, (cx, cy));
            Kind::Circle {
                cx,
                cy,
                r: if dot { r } else { r * t.scale },
                dot,
            }
        }
        Kind::Arc {
            cx,
            cy,
            r,
            start,
            end,
        } => {
            let (cx, cy) = apply(t, (cx, cy));
            Kind::Arc {
                cx,
                cy,
                r: r * t.scale,
                start: start + t.angle,
                end: end + t.angle,
            }
        }
        Kind::Ellipse {
            cx,
            cy,
            rx,
            ry,
            rotation,
        } => {
            let (cx, cy) = apply(t, (cx, cy));
            Kind::Ellipse {
                cx,
                cy,
                rx: rx * t.scale,
                ry: ry * t.scale,
                rotation: rotation + t.angle,
            }
        }
        Kind::Path { segments } => Kind::Path {
            segments: segments.iter().map(|s| s.map(t)).collect(),
        },
    };
    Flat { kind, ..item }
}

/// Vertices of a star polygon, outer vertex first at `rotation` degrees.
#[must_use]
pub fn star_points(
    cx: f64,
    cy: f64,
    points: u32,
    outer: f64,
    inner: f64,
    rotation: f64,
) -> Vec<Vec2> {
    (0..points * 2)
        .map(|k| {
            let r = if k % 2 == 0 { outer } else { inner };
            let (cos, sin) = cos_sin(rotation + (f64::from(k) * 180.0) / f64::from(points));
            (cx + r * cos, cy + r * sin)
        })
        .collect()
}
