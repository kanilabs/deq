"""The shape catalog: lookup with "did you mean" hints, listing and categories."""

from functools import cache
from typing import Any

from ._data import load
from ._format import js_json
from .errors import DeqError

Shape = dict[str, Any]


def _shapes() -> list[Shape]:
    shapes: list[Shape] = load("shapes.json")["shapes"]
    return shapes


@cache
def _by_id() -> dict[str, Shape]:
    return {s["id"]: s for s in _shapes()}


def _distance(a: str, b: str) -> int:
    """Levenshtein distance."""
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        row = [i]
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            row.append(min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost))
        prev = row
    return prev[len(b)]


def suggest(shape_id: str) -> list[str]:
    """Up to 3 known ids close to ``shape_id`` (also matching aliases and substrings)."""
    q = shape_id.lower()
    scored = []
    for s in _shapes():
        names = [s["id"], *s["aliases"]]
        best = min(0 if q in n else _distance(q, n) for n in names)
        scored.append((best, s["id"]))
    limit = max(2, len(q) // 3)
    return [i for best, i in sorted(x for x in scored if x[0] <= limit)[:3]]


def get_shape(shape_id: str) -> Shape:
    """The shape with this id; raises ``DeqError`` (``UNKNOWN_SHAPE``) with suggestions."""
    shape = _by_id().get(shape_id) if isinstance(shape_id, str) else None
    if shape is not None:
        return shape
    if isinstance(shape_id, str):
        label = js_json(shape_id[:64])
        hints = suggest(shape_id[:64])
    else:
        label, hints = "object", []
    hint = f" Did you mean {', '.join(hints)}?" if hints else ""
    raise DeqError("UNKNOWN_SHAPE", f"unknown shape {label}.{hint} See listShapes().")


def has_shape(shape_id: str) -> bool:
    return shape_id in _by_id()


def list_shapes(category: str | None = None) -> list[Shape]:
    """Every shape in catalog order, optionally only one category."""
    return [s for s in _shapes() if category is None or s["category"] == category]


def list_categories() -> list[str]:
    """Category ids in catalog order."""
    return list(dict.fromkeys(s["category"] for s in _shapes()))
