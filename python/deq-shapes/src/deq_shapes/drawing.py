"""A format-neutral vector drawing built from flat geometry, used by the PDF writer.

It follows the same paint rules as the SVG output.
"""

import math
from dataclasses import dataclass

from . import geometry as g
from ._format import js_mod
from .color import BLACK, Rgba, parse_color
from .svg import CANVAS, Prepared, is_closed, is_filled

#: A path command in canvas units: ("m", x, y), ("l", x, y), ("c", x1, y1, x2, y2, x, y), ("h",).
PathCmd = tuple[str, *tuple[float, ...]]
#: An affine matrix ``(a, b, c, d, e, f)`` (PDF ``cm`` order).
Matrix = tuple[float, float, float, float, float, float]


@dataclass(frozen=True, slots=True)
class DrawOp:
    """One painted path. Colours carry the final alpha (colour alpha x opacity)."""

    path: tuple[PathCmd, ...]
    fill: Rgba | None = None
    stroke: Rgba | None = None


@dataclass(frozen=True, slots=True)
class Layer:
    id: str
    ops: tuple[DrawOp, ...]


@dataclass(frozen=True, slots=True)
class Drawing:
    #: Page width and height in points (1 px = 0.75 pt).
    width: float
    height: float
    #: Canvas units to page points, with the y axis flipped.
    base: Matrix
    #: The rotation/flip transforms, outermost first.
    transforms: tuple[Matrix, ...]
    line_width: float
    linecap: int
    linejoin: int
    background: DrawOp | None
    #: Layers in first-use (bottom to top) order.
    layers: tuple[Layer, ...]
    title: str


#: Bézier constant for a quarter circle.
KAPPA = 0.5522847498307936
_QUADS = (
    (1, KAPPA, KAPPA, 1, 0, 1),
    (-KAPPA, 1, -1, KAPPA, -1, 0),
    (-1, -KAPPA, -KAPPA, -1, 0, -1),
    (KAPPA, -1, 1, -KAPPA, 1, 0),
)


def _map(m: Matrix, x: float, y: float) -> tuple[float, float]:
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


def _unit_circle(m: Matrix) -> list[PathCmd]:
    """A full ellipse as four cubic Béziers, mapped by ``m`` from the unit circle."""
    out: list[PathCmd] = [("m", *_map(m, 1, 0))]
    for x1, y1, x2, y2, x, y in _QUADS:
        out.append(("c", *_map(m, x1, y1), *_map(m, x2, y2), *_map(m, x, y)))
    out.append(("h",))
    return out


def _circle_matrix(cx: float, cy: float, r: float) -> Matrix:
    return (r, 0, 0, r, cx, cy)


def _arc_path(cx: float, cy: float, r: float, start: float, end: float) -> list[PathCmd]:
    """An open arc from ``start`` to ``end`` degrees (clockwise, y down), in <= 90° Béziers."""
    n = max(1, math.ceil((end - start) / 90 - 1e-9))
    step = (end - start) / n
    alpha = (4 / 3) * math.tan((step * math.pi) / 720)
    c0, s0 = g.cos_sin(start)
    out: list[PathCmd] = [("m", cx + r * c0, cy + r * s0)]
    for i in range(n):
        ca, sa = g.cos_sin(start + i * step)
        cb, sb = g.cos_sin(start + (i + 1) * step)
        out.append(
            (
                "c",
                cx + r * (ca - alpha * sa),
                cy + r * (sa + alpha * ca),
                cx + r * (cb + alpha * sb),
                cy + r * (sb - alpha * cb),
                cx + r * cb,
                cy + r * sb,
            )
        )
    return out


def _path_cmds(item: g.Flat, dot_scale: float) -> list[PathCmd]:
    if isinstance(item, g.FlatPoly):
        if not item.points:
            return []
        first, *rest = item.points
        out: list[PathCmd] = [("m", first[0], first[1]), *(("l", p[0], p[1]) for p in rest)]
        if item.closed:
            out.append(("h",))
        return out
    if isinstance(item, g.FlatCircle):
        r = item.r * dot_scale if item.dot else item.r
        return _unit_circle(_circle_matrix(item.cx, item.cy, r))
    if isinstance(item, g.FlatArc):
        if item.end - item.start >= 360:
            return _unit_circle(_circle_matrix(item.cx, item.cy, item.r))
        return _arc_path(item.cx, item.cy, item.r, item.start, item.end)
    if isinstance(item, g.FlatEllipse):
        c, s = g.cos_sin(item.rotation)
        return _unit_circle((c * item.rx, s * item.rx, -s * item.ry, c * item.ry, item.cx, item.cy))
    out = []
    cur: g.Vec = (0, 0)
    start: g.Vec = (0, 0)
    for seg in item.segments:
        cmd = seg[0]
        pts: tuple[g.Vec, ...] = seg[1:]
        if cmd == "M":
            out.append(("m", pts[0][0], pts[0][1]))
            cur = start = pts[0]
        elif cmd == "L":
            out.append(("l", pts[0][0], pts[0][1]))
            cur = pts[0]
        elif cmd == "Q":
            q, p = pts
            out.append(
                (
                    "c",
                    cur[0] + (2 / 3) * (q[0] - cur[0]),
                    cur[1] + (2 / 3) * (q[1] - cur[1]),
                    p[0] + (2 / 3) * (q[0] - p[0]),
                    p[1] + (2 / 3) * (q[1] - p[1]),
                    p[0],
                    p[1],
                )
            )
            cur = p
        elif cmd == "C":
            c1, c2, p = pts
            out.append(("c", c1[0], c1[1], c2[0], c2[1], p[0], p[1]))
            cur = p
        else:
            out.append(("h",))
            cur = start
    return out


def _with_alpha(c: Rgba, opacity: float) -> Rgba:
    return (c[0], c[1], c[2], c[3] * opacity)


_CAP = {"butt": 0, "round": 1, "square": 2}
_JOIN = {"miter": 0, "round": 1, "bevel": 2}


def build_drawing(p: Prepared, current_color: Rgba = BLACK) -> Drawing:
    """Build the drawing for prepared geometry; ``current_color`` stands in for currentColor."""
    o = p.options
    box = CANVAS + 2 * o.padding
    width = o.size * 0.75
    k = width / box
    root = parse_color(o.color, current_color)
    inks: dict[str, Rgba] = {}

    def ink(layer: str) -> Rgba:
        if layer not in inks:
            lc = o.layer_colors.get(layer)
            inks[layer] = root if lc is None else parse_color(lc, root)
        return inks[layer]

    layers: dict[str, list[DrawOp]] = {}
    for item in p.items:
        path = tuple(_path_cmds(item, o.dot_scale))
        if not path:
            continue
        color = ink(item.layer)
        if is_filled(item):
            op = DrawOp(path, fill=_with_alpha(color, o.stroke_opacity))
        elif o.fill != "none" and is_closed(item):
            op = DrawOp(
                path,
                fill=_with_alpha(parse_color(o.fill, color), o.fill_opacity),
                stroke=_with_alpha(color, o.stroke_opacity),
            )
        else:
            op = DrawOp(path, stroke=_with_alpha(color, o.stroke_opacity))
        layers.setdefault(item.layer, []).append(op)

    transforms: list[Matrix] = []
    if js_mod(o.rotation, 360) != 0:
        c, s = g.cos_sin(o.rotation)
        m = CANVAS / 2
        transforms.append((c, s, -s, c, m - c * m + s * m, m - s * m - c * m))
    if o.flip_x or o.flip_y:
        transforms.append(
            (
                -1 if o.flip_x else 1,
                0,
                0,
                -1 if o.flip_y else 1,
                CANVAS if o.flip_x else 0,
                CANVAS if o.flip_y else 0,
            )
        )

    background = None
    if o.background != "none":
        lo, hi = -o.padding, CANVAS + o.padding
        background = DrawOp(
            (("m", lo, lo), ("l", hi, lo), ("l", hi, hi), ("l", lo, hi), ("h",)),
            fill=parse_color(o.background, root),
        )

    return Drawing(
        width=width,
        height=width,
        base=(k, 0, 0, -k, k * o.padding, width - k * o.padding),
        transforms=tuple(transforms),
        line_width=(o.stroke_width * box) / o.size if o.absolute_stroke_width else o.stroke_width,
        linecap=_CAP[o.linecap],
        linejoin=_JOIN[o.linejoin],
        background=background,
        layers=tuple(Layer(layer, tuple(ops)) for layer, ops in layers.items()),
        title=o.title if o.title is not None else p.default_title,
    )
