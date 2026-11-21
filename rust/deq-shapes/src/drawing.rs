//! A format-neutral vector drawing built from flat geometry, used by the PDF writer.
//!
//! It follows the same paint rules as the SVG output.

use crate::color::{Rgba, parse_color};
use crate::error::Result;
use crate::format::js_mod;
use crate::geometry::{self as g, Flat, Kind, Segment, Vec2};
use crate::svg::{CANVAS, Prepared, is_closed, is_filled};

/// A path command in canvas units.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PathCmd {
    /// Move to.
    M(f64, f64),
    /// Line to.
    L(f64, f64),
    /// Cubic Bézier: two control points and the end point.
    C([f64; 6]),
    /// Close the subpath.
    H,
}

/// An affine matrix `(a, b, c, d, e, f)` (PDF `cm` order).
pub type Matrix = [f64; 6];

/// One painted path. Colours carry the final alpha (colour alpha x opacity).
#[derive(Debug, Clone, PartialEq)]
pub struct DrawOp {
    /// The outline.
    pub path: Vec<PathCmd>,
    /// The fill colour, if filled.
    pub fill: Option<Rgba>,
    /// The stroke colour, if stroked.
    pub stroke: Option<Rgba>,
}

/// The paint operations of one layer.
#[derive(Debug, Clone, PartialEq)]
pub struct Layer {
    /// The layer id.
    pub id: String,
    /// Its paint operations, bottom to top.
    pub ops: Vec<DrawOp>,
}

/// A drawing ready for a vector writer.
#[derive(Debug, Clone, PartialEq)]
pub struct Drawing {
    /// Page width in points (1 px = 0.75 pt).
    pub width: f64,
    /// Page height in points.
    pub height: f64,
    /// Canvas units to page points, with the y axis flipped.
    pub base: Matrix,
    /// The rotation/flip transforms, outermost first.
    pub transforms: Vec<Matrix>,
    /// Stroke width in canvas units.
    pub line_width: f64,
    /// PDF line cap (0 butt, 1 round, 2 square).
    pub linecap: u8,
    /// PDF line join (0 miter, 1 round, 2 bevel).
    pub linejoin: u8,
    /// The background, if any.
    pub background: Option<DrawOp>,
    /// Layers in first-use (bottom to top) order.
    pub layers: Vec<Layer>,
    /// The document title.
    pub title: String,
}

/// Bézier constant for a quarter circle.
pub const KAPPA: f64 = 0.552_284_749_830_793_6;
const QUADS: [[f64; 6]; 4] = [
    [1.0, KAPPA, KAPPA, 1.0, 0.0, 1.0],
    [-KAPPA, 1.0, -1.0, KAPPA, -1.0, 0.0],
    [-1.0, -KAPPA, -KAPPA, -1.0, 0.0, -1.0],
    [KAPPA, -1.0, 1.0, -KAPPA, 1.0, 0.0],
];

fn map(m: &Matrix, x: f64, y: f64) -> Vec2 {
    (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
}

/// A full ellipse as four cubic Béziers, mapped by `m` from the unit circle.
fn unit_circle(m: &Matrix) -> Vec<PathCmd> {
    let (x, y) = map(m, 1.0, 0.0);
    let mut out = vec![PathCmd::M(x, y)];
    for q in QUADS {
        let (a, b) = map(m, q[0], q[1]);
        let (c, d) = map(m, q[2], q[3]);
        let (e, f) = map(m, q[4], q[5]);
        out.push(PathCmd::C([a, b, c, d, e, f]));
    }
    out.push(PathCmd::H);
    out
}

fn circle_matrix(cx: f64, cy: f64, r: f64) -> Matrix {
    [r, 0.0, 0.0, r, cx, cy]
}

/// An open arc from `start` to `end` degrees (clockwise, y down), in <= 90° Béziers.
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_precision_loss
)]
fn arc_path(cx: f64, cy: f64, r: f64, start: f64, end: f64) -> Vec<PathCmd> {
    let n = ((end - start) / 90.0 - 1e-9).ceil().max(1.0) as u32;
    let step = (end - start) / f64::from(n);
    let alpha = (4.0 / 3.0) * ((step * std::f64::consts::PI) / 720.0).tan();
    let (c0, s0) = g::cos_sin(start);
    let mut out = vec![PathCmd::M(cx + r * c0, cy + r * s0)];
    for i in 0..n {
        let (ca, sa) = g::cos_sin(start + f64::from(i) * step);
        let (cb, sb) = g::cos_sin(start + f64::from(i + 1) * step);
        out.push(PathCmd::C([
            cx + r * (ca - alpha * sa),
            cy + r * (sa + alpha * ca),
            cx + r * (cb + alpha * sb),
            cy + r * (sb - alpha * cb),
            cx + r * cb,
            cy + r * sb,
        ]));
    }
    out
}

fn path_cmds(item: &Flat, dot_scale: f64) -> Vec<PathCmd> {
    match &item.kind {
        Kind::Poly { points, closed } => {
            let Some((first, rest)) = points.split_first() else {
                return Vec::new();
            };
            let mut out = vec![PathCmd::M(first.0, first.1)];
            out.extend(rest.iter().map(|p| PathCmd::L(p.0, p.1)));
            if *closed {
                out.push(PathCmd::H);
            }
            out
        }
        Kind::Circle { cx, cy, r, dot } => unit_circle(&circle_matrix(
            *cx,
            *cy,
            if *dot { r * dot_scale } else { *r },
        )),
        Kind::Arc {
            cx,
            cy,
            r,
            start,
            end,
        } => {
            if end - start >= 360.0 {
                unit_circle(&circle_matrix(*cx, *cy, *r))
            } else {
                arc_path(*cx, *cy, *r, *start, *end)
            }
        }
        Kind::Ellipse {
            cx,
            cy,
            rx,
            ry,
            rotation,
        } => {
            let (c, s) = g::cos_sin(*rotation);
            unit_circle(&[c * rx, s * rx, -s * ry, c * ry, *cx, *cy])
        }
        Kind::Path { segments } => {
            let mut out = Vec::new();
            let (mut cur, mut start): (Vec2, Vec2) = ((0.0, 0.0), (0.0, 0.0));
            for seg in segments {
                match *seg {
                    Segment::M(p) => {
                        out.push(PathCmd::M(p.0, p.1));
                        (cur, start) = (p, p);
                    }
                    Segment::L(p) => {
                        out.push(PathCmd::L(p.0, p.1));
                        cur = p;
                    }
                    Segment::Q(q, p) => {
                        out.push(PathCmd::C([
                            cur.0 + (2.0 / 3.0) * (q.0 - cur.0),
                            cur.1 + (2.0 / 3.0) * (q.1 - cur.1),
                            p.0 + (2.0 / 3.0) * (q.0 - p.0),
                            p.1 + (2.0 / 3.0) * (q.1 - p.1),
                            p.0,
                            p.1,
                        ]));
                        cur = p;
                    }
                    Segment::C(c1, c2, p) => {
                        out.push(PathCmd::C([c1.0, c1.1, c2.0, c2.1, p.0, p.1]));
                        cur = p;
                    }
                    Segment::Z => {
                        out.push(PathCmd::H);
                        cur = start;
                    }
                }
            }
            out
        }
    }
}

fn with_alpha(c: Rgba, opacity: f64) -> Rgba {
    (c.0, c.1, c.2, c.3 * opacity)
}

/// Build the drawing for prepared geometry; `current_color` stands in for currentColor.
///
/// # Errors
/// `InvalidOptions` when a colour cannot be parsed.
#[allow(clippy::too_many_lines)]
pub fn build_drawing(p: &Prepared, current_color: Rgba) -> Result<Drawing> {
    let o = &p.options;
    let bx = CANVAS + 2.0 * o.padding;
    let width = o.size * 0.75;
    let k = width / bx;
    let root = parse_color(&o.color, current_color)?;
    let mut inks: Vec<(String, Rgba)> = Vec::new();
    let mut layers: Vec<Layer> = Vec::new();
    for item in &p.items {
        let path = path_cmds(item, o.dot_scale);
        if path.is_empty() {
            continue;
        }
        let color = if let Some((_, c)) = inks.iter().find(|(l, _)| *l == item.layer) {
            *c
        } else {
            let c = match o.layer_color(&item.layer) {
                Some(lc) => parse_color(lc, root)?,
                None => root,
            };
            inks.push((item.layer.clone(), c));
            c
        };
        let op = if is_filled(item) {
            DrawOp {
                path,
                fill: Some(with_alpha(color, o.stroke_opacity)),
                stroke: None,
            }
        } else if o.fill != "none" && is_closed(item) {
            DrawOp {
                path,
                fill: Some(with_alpha(parse_color(&o.fill, color)?, o.fill_opacity)),
                stroke: Some(with_alpha(color, o.stroke_opacity)),
            }
        } else {
            DrawOp {
                path,
                fill: None,
                stroke: Some(with_alpha(color, o.stroke_opacity)),
            }
        };
        match layers.iter_mut().find(|l| l.id == item.layer) {
            Some(l) => l.ops.push(op),
            None => layers.push(Layer {
                id: item.layer.clone(),
                ops: vec![op],
            }),
        }
    }
    let mut transforms: Vec<Matrix> = Vec::new();
    if js_mod(o.rotation, 360.0) != 0.0 {
        let (c, s) = g::cos_sin(o.rotation);
        let m = CANVAS / 2.0;
        transforms.push([c, s, -s, c, m - c * m + s * m, m - s * m - c * m]);
    }
    if o.flip_x || o.flip_y {
        let sx = if o.flip_x { -1.0 } else { 1.0 };
        let sy = if o.flip_y { -1.0 } else { 1.0 };
        transforms.push([
            sx,
            0.0,
            0.0,
            sy,
            if o.flip_x { CANVAS } else { 0.0 },
            if o.flip_y { CANVAS } else { 0.0 },
        ]);
    }
    let background = if o.background == "none" {
        None
    } else {
        let (lo, hi) = (-o.padding, CANVAS + o.padding);
        let path = vec![
            PathCmd::M(lo, lo),
            PathCmd::L(hi, lo),
            PathCmd::L(hi, hi),
            PathCmd::L(lo, hi),
            PathCmd::H,
        ];
        Some(DrawOp {
            path,
            fill: Some(parse_color(&o.background, root)?),
            stroke: None,
        })
    };
    let linecap = match o.linecap.as_str() {
        "butt" => 0,
        "square" => 2,
        _ => 1,
    };
    let linejoin = match o.linejoin.as_str() {
        "miter" => 0,
        "bevel" => 2,
        _ => 1,
    };
    Ok(Drawing {
        width,
        height: width,
        base: [k, 0.0, 0.0, -k, k * o.padding, width - k * o.padding],
        transforms,
        line_width: if o.absolute_stroke_width {
            (o.stroke_width * bx) / o.size
        } else {
            o.stroke_width
        },
        linecap,
        linejoin,
        background,
        layers,
        title: o.title.clone().unwrap_or_else(|| p.default_title.clone()),
    })
}
