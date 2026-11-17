"""Turn flat shape geometry into filled outlines that look like SVG round-cap strokes.

Every stroke becomes simple contours that overlap: a capsule per line segment, a ring per
circle and a band with round caps per arc. Their points depend linearly on the stroke width
and their structure never does, so the outlines of two weights interpolate exactly (the
variable font) and a union of the contours removes the overlaps (the static fonts).

Coordinates are canvas units (24 x 24, y down) until :func:`to_font` maps them to font units.
"""

from __future__ import annotations

import itertools
import math
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

Point = tuple[float, float]

CANVAS = 24.0
#: Font units per canvas unit, so the 24-unit canvas is the 960-unit em.
SCALE = 40
UPM = int(CANVAS * SCALE)
#: The canvas row that sits on the baseline (the bottom of lowercase letters).
BASELINE = 19.0
#: The smallest inner radius of a ring or band, so heavy weights stay valid outlines.
MIN_INNER = 0.05
#: Line pieces per curve segment when a path is flattened.
FLATTEN = {"Q": 8, "C": 12}


@dataclass(frozen=True)
class Node:
    """A contour point: on the outline, or the control point of a quadratic curve."""

    x: float
    y: float
    on: bool = True


Contour = list[Node]


class Pen(Protocol):
    """The part of the fontTools pen protocol that :func:`draw` uses."""

    def moveTo(self, pt: Point) -> None: ...  # noqa: N802
    def lineTo(self, pt: Point) -> None: ...  # noqa: N802
    def qCurveTo(self, *points: Point) -> None: ...  # noqa: N802
    def closePath(self) -> None: ...  # noqa: N802


def _dir(degrees: float) -> Point:
    rad = math.radians(degrees)
    return math.cos(rad), math.sin(rad)


def arc_nodes(cx: float, cy: float, r: float, start: float, end: float) -> list[Node]:
    """Quadratic segments of at most 45 degrees from ``start`` to ``end``, without the start
    point. The segment count depends only on the sweep, never on the radius."""
    sweep = end - start
    count = max(1, math.ceil(abs(sweep) / 45 - 1e-9))
    step = sweep / count
    out: list[Node] = []
    for k in range(count):
        mid = start + step * (k + 0.5)
        far = r / math.cos(math.radians(step / 2))
        mx, my = _dir(mid)
        ex, ey = _dir(start + step * (k + 1))
        out += [Node(cx + far * mx, cy + far * my, on=False), Node(cx + r * ex, cy + r * ey)]
    return out


def circle(cx: float, cy: float, r: float) -> Contour:
    """A full circle in 8 quadratic segments, starting at angle 0."""
    return [Node(cx + r, cy), *arc_nodes(cx, cy, r, 0, 360)[:-1]]


def capsule(p: Point, q: Point, h: float) -> Contour:
    """The outline of a round-capped stroke of half width ``h`` from ``p`` to ``q``."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dy)
    angle = math.degrees(math.atan2(dy, dx)) if length > 1e-9 else 0.0
    nx, ny = _dir(angle + 90)
    return [
        Node(p[0] + nx * h, p[1] + ny * h),
        Node(q[0] + nx * h, q[1] + ny * h),
        *arc_nodes(q[0], q[1], h, angle + 90, angle - 90),
        Node(p[0] - nx * h, p[1] - ny * h),
        *arc_nodes(p[0], p[1], h, angle - 90, angle - 270)[:-1],
    ]


def band(cx: float, cy: float, r: float, start: float, end: float, h: float) -> Contour:
    """The outline of a round-capped stroke along an arc (angles in degrees, y down)."""
    inner = max(r - h, MIN_INNER)
    sx, sy = _dir(start)
    ex, ey = _dir(end)
    return [
        Node(cx + (r + h) * sx, cy + (r + h) * sy),
        *arc_nodes(cx, cy, r + h, start, end),
        *arc_nodes(cx + r * ex, cy + r * ey, h, end, end + 180),
        *arc_nodes(cx, cy, inner, end, start),
        *arc_nodes(cx + r * sx, cy + r * sy, h, start + 180, start + 360)[:-1],
    ]


def _flatten(segments: Sequence[Sequence[Any]]) -> list[list[Point]]:
    """Path segments as polylines (curves split into fixed numbers of pieces)."""
    lines: list[list[Point]] = []
    pen: Point = (0.0, 0.0)
    begin: Point = pen
    for seg in segments:
        op, pts = seg[0], [(float(x), float(y)) for x, y in seg[1:]]
        if op == "M":
            pen = begin = pts[0]
            lines.append([pen])
        elif op == "L":
            pen = pts[0]
            lines[-1].append(pen)
        elif op in FLATTEN:
            ctrl = [pen, *pts]
            n = FLATTEN[op]
            lines[-1] += [_bezier(ctrl, k / n) for k in range(1, n + 1)]
            pen = pts[-1]
        elif op == "Z":
            lines[-1].append(begin)
            pen = begin
        else:
            raise ValueError(f"unsupported path command: {op}")
    return lines


def _bezier(ctrl: Sequence[Point], t: float) -> Point:
    pts = list(ctrl)
    while len(pts) > 1:
        pts = [
            (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for a, b in itertools.pairwise(pts)
        ]
    return pts[0]


def _segments(points: Sequence[Point], closed: bool) -> Iterable[tuple[Point, Point]]:
    if len(points) == 1:
        yield points[0], points[0]
    yield from itertools.pairwise(points)
    if closed and len(points) > 2:
        yield points[-1], points[0]


@dataclass(frozen=True)
class Outline:
    """Contours that are drawn filled, and contours that cut holes out of them."""

    solid: list[Contour]
    holes: list[Contour]


def outline(items: Iterable[Mapping[str, Any]], stroke: float, dot_scale: float = 1.0) -> Outline:
    """The filled outline of flat items (core's ``expand`` output) at ``stroke`` width."""
    h = stroke / 2
    solid: list[Contour] = []
    holes: list[Contour] = []
    for item in items:
        kind, paint = item["kind"], item.get("paint", "stroke")
        if kind == "poly":
            pts = [(float(x), float(y)) for x, y in item["points"]]
            if paint == "fill":
                solid.append([Node(x, y) for x, y in pts])
            else:
                solid += [capsule(p, q, h) for p, q in _segments(pts, bool(item["closed"]))]
        elif kind == "circle":
            cx, cy, r = float(item["cx"]), float(item["cy"]), float(item["r"])
            if item.get("dot"):
                solid.append(circle(cx, cy, r * dot_scale))
            elif paint == "fill":
                solid.append(circle(cx, cy, r))
            else:
                solid.append(circle(cx, cy, r + h))
                holes.append(circle(cx, cy, max(r - h, MIN_INNER)))
        elif kind == "arc":
            solid.append(band(item["cx"], item["cy"], item["r"], item["start"], item["end"], h))
        elif kind == "path" and paint == "stroke":
            for line in _flatten(item["segments"]):
                solid += [capsule(p, q, h) for p, q in _segments(line, closed=False)]
        else:
            raise ValueError(f"unsupported item: {kind} ({paint})")
    return Outline(solid, holes)


def area(contour: Contour) -> float:
    """Signed area of the control polygon (positive is counter-clockwise, y up)."""
    total = 0.0
    for a, b in zip(contour, contour[1:] + contour[:1], strict=True):
        total += a.x * b.y - b.x * a.y
    return total / 2


def _reverse(contour: Contour) -> Contour:
    return [contour[0], *reversed(contour[1:])]


def to_font(shape: Outline) -> list[Contour]:
    """Map to font units (y up, baseline at 0) with TrueType winding: filled contours run
    clockwise and holes counter-clockwise, so overlapping contours fill as a union."""

    def place(c: Contour) -> Contour:
        return [Node(n.x * SCALE, (BASELINE - n.y) * SCALE, n.on) for n in c]

    out: list[Contour] = []
    for contours, clockwise in ((shape.solid, True), (shape.holes, False)):
        for c in map(place, contours):
            out.append(_reverse(c) if (area(c) < 0) != clockwise else c)
    return out


def draw(contours: Iterable[Contour], pen: Pen) -> None:
    """Draw contours with a fontTools pen."""
    for contour in contours:
        pen.moveTo((contour[0].x, contour[0].y))
        pending: list[Point] = []
        for node in [*contour[1:], contour[0]]:
            pt = (node.x, node.y)
            if not node.on:
                pending.append(pt)
            elif pending:
                pen.qCurveTo(*pending, pt)
                pending = []
            elif node is not contour[0]:
                pen.lineTo(pt)
        pen.closePath()
