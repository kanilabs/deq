"""Seeded pattern generator: bands, grids, rosettes and borders of Deq motifs (ADR 0015)."""

import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Final, Literal

from . import geometry as g
from ._format import is_integer
from .errors import DeqError
from .leet import _integer, split_options
from .options import _number, _picklist
from .registry import get_shape, list_shapes
from .rng import MAX_SEED, Random
from .scene import Cell, Scene, resolve_scene_options, scene_svg

PatternKind = Literal["band", "grid", "rosette", "border"]

_ID: Final = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def _motifs(v: Any) -> str | None:
    if not isinstance(v, list | tuple) or not 1 <= len(v) <= 64:
        return "must be a list of 1 to 64 shape ids"
    if not all(isinstance(s, str) and len(s) <= 64 and _ID.fullmatch(s) for s in v):
        return "must be a list of 1 to 64 shape ids"
    return None


def _odd(v: Any) -> str | None:
    if not is_integer(v):
        return "must be an integer"
    if not 3 <= v <= 63:
        return f"must be from 3 to 63 (got {v})"
    return None if v % 2 == 1 else "must be odd"


_CHECKS: Final[tuple[tuple[str, Callable[[Any], str | None]], ...]] = (
    ("kind", _picklist("band", "grid", "rosette", "border")),
    ("seed", _integer(0, MAX_SEED)),
    ("motifs", _motifs),
    ("count", _odd),
    ("cols", _integer(1, 32)),
    ("rows", _integer(1, 32)),
    ("petals", _integer(3, 24)),
    ("spacing", _number(0, 24)),
)


@dataclass(frozen=True, slots=True)
class PatternResult:
    """The result of :func:`pattern`."""

    #: The SVG document, one ``<g data-layer="cN">`` per motif.
    svg: str
    #: The motifs chosen, in the order the pattern uses them.
    motifs: tuple[str, ...]
    scene: Scene


def _fail(issue: str) -> DeqError:
    return DeqError("INVALID_OPTIONS", f"invalid pattern options: {issue}", (issue,))


def _choose(pool: Sequence[str], count: int, random: Random) -> list[str]:
    """``count`` distinct motifs from ``pool`` (repeating only when the pool is smaller)."""
    left = list(pool)
    out: list[str] = []
    for _ in range(count):
        if not left:
            left.extend(pool)
        out.append(left.pop(random.below(len(left))))
    return out


def _nth(items: Sequence[str], i: int) -> str:
    return items[i % len(items)]


def _cell(x: float, y: float, shape: str, rotate: float = 0, scale: float = 1) -> Cell:
    part: dict[str, Any] = {"shape": shape}
    if rotate != 0 or scale != 1:
        transform: dict[str, float] = {}
        if scale != 1:
            transform["scale"] = scale
        if rotate != 0:
            transform["rotate"] = rotate
        part["transform"] = transform
    return Cell(x, y, (part,))


def pattern(options: Mapping[str, Any] | None = None) -> PatternResult:
    """Generate a pattern of Deq motifs.

    ``band`` repeats motifs in a row (alternating or mirrored), ``grid`` lays a checkerboard,
    ``rosette`` rings petals round a centre and ``border`` frames a rectangle. Options are
    ``kind``, ``seed``, ``motifs``, ``count``, ``cols``, ``rows``, ``petals``, ``spacing``,
    ``colors`` and the render options except the per-shape ones.

    :raises DeqError: ``INVALID_OPTIONS``, ``UNKNOWN_SHAPE`` or ``LIMIT_EXCEEDED``.
    """
    own, scene = split_options(options, _CHECKS, "pattern options")
    resolve_scene_options(scene)
    pool: list[str] = list(own.get("motifs") or [s["id"] for s in list_shapes()])
    for shape_id in pool:
        get_shape(shape_id)
    random = Random(own.get("seed", 1))
    step = 24 + own.get("spacing", 2)
    kind: PatternKind = own.get("kind", "band")
    cells: list[Cell] = []
    if kind == "band":
        n: int = own.get("count", 9)
        mirror = random.below(2) == 1
        used = _choose(pool, 3 if mirror else 2, random)
        order = [min(i, n - 1 - i) if mirror else i for i in range(n)]
        cells = [_cell(i * step, 0, _nth(used, j)) for i, j in enumerate(order)]
        width, height = n * step - (step - 24), 24
    elif kind == "grid":
        c, r = own.get("cols", 5), own.get("rows", 5)
        used = _choose(pool, 2, random)
        cells = [_cell(x * step, y * step, _nth(used, x + y)) for y in range(r) for x in range(c)]
        width, height = c * step - (step - 24), r * step - (step - 24)
    elif kind == "rosette":
        n = own.get("petals", 8)
        used = _choose(pool, 2, random)
        cells = [_cell(step, step, _nth(used, 0))]
        for i in range(n):
            angle = 360 * i / n
            cos, sin = g.cos_sin(angle)
            cells.append(_cell(step + step * sin, step - step * cos, _nth(used, 1), angle, 0.75))
        width = height = 2 * step + 24
    else:
        c, r = own.get("cols", 7), own.get("rows", 3)
        if c < 3 or r < 3:
            raise _fail("cols, rows: a border needs at least 3 x 3 cells")
        used = _choose(pool, 2, random)
        corner, edge = _nth(used, 0), _nth(used, 1)
        right, bottom = (c - 1) * step, (r - 1) * step
        for x in range(c):
            end = x in (0, c - 1)
            cells.append(_cell(x * step, 0, corner if end else edge, 90 if end and x > 0 else 0))
        cells.extend(_cell(right, y * step, edge, 90) for y in range(1, r - 1))
        for x in range(c - 1, -1, -1):
            end = x in (0, c - 1)
            turn = (180 if x > 0 else 270) if end else 180
            cells.append(_cell(x * step, bottom, corner if end else edge, turn))
        cells.extend(_cell(0, y * step, edge, 270) for y in range(r - 2, 0, -1))
        width, height = right + 24, bottom + 24
    placed = Scene(width, height, tuple(cells))
    svg = scene_svg(placed, scene, f"Deq {kind} pattern")
    return PatternResult(svg, tuple(used), placed)
