"""Flat geometry: what a shape expands to, plus similarity transforms and path parsing."""

import math
import re
from dataclasses import dataclass, replace
from typing import Literal

from ._format import js_json, js_mod
from .errors import DeqError

Vec = tuple[float, float]
Paint = Literal["stroke", "fill"]


@dataclass(frozen=True, slots=True)
class Transform:
    """``p' = [a c e; b d f] p``, with the uniform scale and rotation angle it contains."""

    a: float
    b: float
    c: float
    d: float
    e: float
    f: float
    scale: float
    angle: float


IDENTITY = Transform(1, 0, 0, 1, 0, 0, 1, 0)


def apply(t: Transform, p: Vec) -> Vec:
    return (t.a * p[0] + t.c * p[1] + t.e, t.b * p[0] + t.d * p[1] + t.f)


def chain(inner: Transform, outer: Transform) -> Transform:
    """The transform that applies ``inner`` first, then ``outer``."""
    o, s = outer, inner
    return Transform(
        a=o.a * s.a + o.c * s.b,
        b=o.b * s.a + o.d * s.b,
        c=o.a * s.c + o.c * s.d,
        d=o.b * s.c + o.d * s.d,
        e=o.a * s.e + o.c * s.f + o.e,
        f=o.b * s.e + o.d * s.f + o.f,
        scale=s.scale * o.scale,
        angle=s.angle + o.angle,
    )


def translate(dx: float, dy: float) -> Transform:
    return replace(IDENTITY, e=dx, f=dy)


def cos_sin(deg: float) -> Vec:
    """Cosine and sine of ``deg`` degrees, exact at multiples of 90."""
    m = js_mod(js_mod(deg, 360) + 360, 360)
    if m == 0:
        return (1, 0)
    if m == 90:
        return (0, 1)
    if m == 180:
        return (-1, 0)
    if m == 270:
        return (0, -1)
    t = (deg * math.pi) / 180
    return (math.cos(t), math.sin(t))


def rotate(deg: float, center: Vec = (0, 0)) -> Transform:
    """Rotate clockwise on screen (y points down) by ``deg`` about ``center``."""
    cos, sin = cos_sin(deg)
    cx, cy = center
    return Transform(
        cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy, 1, deg
    )


def scale(s: float, center: Vec = (0, 0)) -> Transform:
    cx, cy = center
    return replace(IDENTITY, a=s, d=s, e=cx - s * cx, f=cy - s * cy, scale=s)


@dataclass(frozen=True, slots=True)
class FlatPoly:
    """A line, polyline or polygon."""

    points: tuple[Vec, ...]
    closed: bool
    layer: str
    paint: Paint
    kind: Literal["poly"] = "poly"


@dataclass(frozen=True, slots=True)
class FlatCircle:
    """A circle; ``dot`` circles are filled and keep their radius under scaling."""

    cx: float
    cy: float
    r: float
    layer: str
    paint: Paint
    dot: bool
    kind: Literal["circle"] = "circle"


@dataclass(frozen=True, slots=True)
class FlatArc:
    cx: float
    cy: float
    r: float
    start: float
    end: float
    layer: str
    paint: Paint
    kind: Literal["arc"] = "arc"


@dataclass(frozen=True, slots=True)
class FlatEllipse:
    cx: float
    cy: float
    rx: float
    ry: float
    rotation: float
    layer: str
    paint: Paint
    kind: Literal["ellipse"] = "ellipse"


#: A path segment with absolute points: ("M", p), ("L", p), ("Q", c, p), ("C", c1, c2, p), ("Z",).
Segment = tuple[str, *tuple[Vec, ...]]


@dataclass(frozen=True, slots=True)
class FlatPath:
    segments: tuple[Segment, ...]
    layer: str
    paint: Paint
    kind: Literal["path"] = "path"


Flat = FlatPoly | FlatCircle | FlatArc | FlatEllipse | FlatPath

_PATH_TOKEN = re.compile(r"[MLHVCQZ]|-?(?:\d+\.?\d*|\.\d+)")
_ARITY = {"M": 2, "L": 2, "H": 1, "V": 1, "Q": 4, "C": 6, "Z": 0}


def parse_path(d: str) -> list[Segment]:
    """Parse absolute ``M L H V C Q Z`` path data into segments with explicit points."""
    tokens = _PATH_TOKEN.findall(d)
    if "".join(tokens) != re.sub(r"\s+", "", d) or not tokens or tokens[0] != "M":
        raise DeqError("INVALID_SHAPE", f"unsupported path data: {js_json(d)}")
    out: list[Segment] = []
    cur: Vec = (0, 0)
    start = cur
    i = 0
    while i < len(tokens):
        cmd = tokens[i]
        n = _ARITY.get(cmd)
        if n is None:
            raise DeqError("INVALID_SHAPE", f"expected a path command at token {i}")
        raw = tokens[i + 1 : i + 1 + n]
        if len(raw) != n or any(t in _ARITY for t in raw):
            raise DeqError("INVALID_SHAPE", f"{cmd} needs {n} numbers")
        v = [float(t) for t in raw]
        i += 1 + n
        if cmd == "M":
            cur = start = (v[0], v[1])
            out.append(("M", cur))
        elif cmd == "L":
            cur = (v[0], v[1])
            out.append(("L", cur))
        elif cmd == "H":
            cur = (v[0], cur[1])
            out.append(("L", cur))
        elif cmd == "V":
            cur = (cur[0], v[0])
            out.append(("L", cur))
        elif cmd == "Q":
            cur = (v[2], v[3])
            out.append(("Q", (v[0], v[1]), cur))
        elif cmd == "C":
            cur = (v[4], v[5])
            out.append(("C", (v[0], v[1]), (v[2], v[3]), cur))
        else:
            out.append(("Z",))
            cur = start
    return out


def _seg_points(seg: Segment) -> tuple[Vec, ...]:
    return seg[1:]


def transform_flat(item: Flat, t: Transform) -> Flat:
    """Apply a similarity transform; dot radii and stroke widths stay unscaled."""
    if t is IDENTITY:
        return item
    if isinstance(item, FlatPoly):
        return replace(item, points=tuple(apply(t, p) for p in item.points))
    if isinstance(item, FlatCircle):
        cx, cy = apply(t, (item.cx, item.cy))
        return replace(item, cx=cx, cy=cy, r=item.r if item.dot else item.r * t.scale)
    if isinstance(item, FlatArc):
        cx, cy = apply(t, (item.cx, item.cy))
        return replace(
            item, cx=cx, cy=cy, r=item.r * t.scale, start=item.start + t.angle,
            end=item.end + t.angle,
        )  # fmt: skip
    if isinstance(item, FlatEllipse):
        cx, cy = apply(t, (item.cx, item.cy))
        return replace(
            item, cx=cx, cy=cy, rx=item.rx * t.scale, ry=item.ry * t.scale,
            rotation=item.rotation + t.angle,
        )  # fmt: skip
    segments: tuple[Segment, ...] = tuple(
        (seg[0], *(apply(t, p) for p in _seg_points(seg))) for seg in item.segments
    )
    return replace(item, segments=segments)


def star_points(
    cx: float, cy: float, points: int, outer: float, inner: float, rotation: float
) -> list[Vec]:
    """Vertices of a star polygon, outer vertex first at ``rotation`` degrees."""
    out: list[Vec] = []
    for k in range(points * 2):
        r = outer if k % 2 == 0 else inner
        cos, sin = cos_sin(rotation + (k * 180) / points)
        out.append((cx + r * cos, cy + r * sin))
    return out
