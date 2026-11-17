"""``deq validate``: a structural check of a shape spec, then a render of every variant.

The same table and messages as ``packages/cli/src/validate.ts`` and the Rust port.
"""

import re
from collections.abc import Callable, Mapping
from typing import Any, Final

from ._format import is_integer, is_number
from .errors import DeqError
from .registry import Shape
from .svg import prepare

#: Fields of each primitive type; ``?`` marks an optional field.
PRIMITIVES: Final[Mapping[str, Mapping[str, str]]] = {
    "line": {"x1": "num", "y1": "num", "x2": "num", "y2": "num"},
    "polyline": {"points": "vecs"},
    "polygon": {"points": "vecs", "paint?": "paint"},
    "path": {"d": "str", "paint?": "paint"},
    "circle": {"cx": "num", "cy": "num", "r": "num", "paint?": "paint"},
    "dot": {"cx": "num", "cy": "num", "r?": "num"},
    "arc": {"cx": "num", "cy": "num", "r": "num", "start": "num", "end": "num"},
    "ellipse": {"cx": "num", "cy": "num", "rx": "num", "ry": "num", "paint?": "paint"},
    "rect": {"x": "num", "y": "num", "width": "num", "height": "num", "paint?": "paint"},
    "star": {
        "cx": "num",
        "cy": "num",
        "points": "count",
        "outerRadius": "num",
        "innerRadius": "num",
        "rotation": "num",
        "paint?": "paint",
    },
    "radial": {
        "count": "count",
        "center": "vec",
        "start": "num",
        "sweep": "num",
        "element": "prim",
    },
    "repeat": {
        "count": "count",
        "step?": "vec",
        "spread?": "vec",
        "align?": "align",
        "element": "prim",
    },
    "concentric": {"count": "count", "center": "vec", "scaleStep": "num", "element": "prim"},
    "use": {"shape": "str", "params?": "params", "transform?": "transform"},
}
_COMMON: Final = {"id?": "str", "layer?": "str", "when?": "when"}
_TRANSFORM: Final = {"translate?": "vec", "scale?": "num", "rotate?": "num", "origin?": "vec"}
#: Top-level fields that do not affect rendering and are not checked.
_DOC_FIELDS: Final = frozenset(
    {"$schema", "meaning", "sources", "construction", "references", "metrics", "symmetryCenter"}
)
_KEBAB = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
#: Largest spec file ``validate`` reads.
MAX_SPEC_BYTES: Final = 256 * 1024
#: Integer parameters with a wider range are checked at min, default and max only.
_MAX_RANGE: Final = 64
_MAX_NESTING: Final = 8


class _InvalidError(Exception):
    pass


def _fail(path: str, what: str) -> _InvalidError:
    return _InvalidError(f"{path}: {what}")


def _is_object(x: object) -> bool:
    return isinstance(x, dict)


def _is_vec(x: object) -> bool:
    return isinstance(x, list) and len(x) == 2 and all(is_number(v) for v in x)


def _is_str_list(x: object) -> bool:
    return isinstance(x, list) and all(isinstance(s, str) for s in x)


def _is_scalar(v: object) -> bool:
    return is_number(v) or isinstance(v, bool | str)


def _check_value(path: str, kind: str, x: Any, depth: int) -> None:
    if kind == "num":
        if not is_number(x):
            raise _fail(path, "must be a number")
    elif kind == "vec":
        if not _is_vec(x):
            raise _fail(path, "must be an [x, y] pair")
    elif kind == "vecs":
        if not isinstance(x, list) or not all(_is_vec(v) for v in x):
            raise _fail(path, "must be a list of [x, y] pairs")
    elif kind == "str":
        if not isinstance(x, str):
            raise _fail(path, "must be a string")
    elif kind == "count":
        ok = (len(x) == 1 and isinstance(x.get("param"), str)) if _is_object(x) else is_number(x)
        if not ok:
            raise _fail(path, 'must be a number or {"param": name}')
    elif kind == "paint":
        if x not in ("stroke", "fill"):
            raise _fail(path, 'must be "stroke" or "fill"')
    elif kind == "align":
        if x not in ("start", "center"):
            raise _fail(path, 'must be "start" or "center"')
    elif kind == "prim":
        _check_primitive(path, x, depth + 1)
    elif not _is_object(x):
        raise _fail(path, "must be an object")
    elif kind == "params":
        for k, v in x.items():
            if not _is_scalar(v):
                raise _fail(f"{path}.{k}", "must be a number, true, false or a string")
    elif kind == "transform":
        _check_fields(path, x, _TRANSFORM, depth)
    else:  # when
        for k, v in x.items():
            ok = _is_scalar(v) or (
                isinstance(v, list) and all(is_number(e) or isinstance(e, str) for e in v)
            )
            if not ok:
                raise _fail(f"{path}.{k}", "must be a value or a list of values")


def _check_fields(path: str, x: dict[str, Any], fields: Mapping[str, str], depth: int) -> None:
    known = {k.replace("?", "", 1) for k in fields}
    for key in x:
        if key not in known:
            raise _fail(path, f'unknown field "{key}"')
    for raw, kind in fields.items():
        key = raw.replace("?", "", 1)
        if key not in x:
            if not raw.endswith("?"):
                raise _fail(path, f'missing field "{key}"')
            continue
        _check_value(f"{path}.{key}", kind, x[key], depth)


def _check_primitive(path: str, x: Any, depth: int) -> None:
    if depth > _MAX_NESTING:
        raise _fail(path, "nested too deeply")
    if not _is_object(x):
        raise _fail(path, "must be an object")
    t = x.get("type")
    fields = PRIMITIVES.get(t) if isinstance(t, str) else None
    if fields is None:
        raise _fail(f"{path}.type", f"must be one of {', '.join(PRIMITIVES)}")
    _check_fields(path, x, {"type?": "str", **_COMMON, **fields}, depth)


def _check_kurdish(path: str, x: Any) -> None:
    if not _is_object(x):
        raise _fail(path, "must be an object")
    if not (x.get("text") is None or isinstance(x.get("text"), str)):
        raise _fail(f"{path}.text", "must be a string or null")
    if not isinstance(x.get("status"), str):
        raise _fail(f"{path}.status", "must be a string")


def _check_parameter(path: str, p: Any) -> None:
    if not _is_object(p):
        raise _fail(path, "must be an object")
    if not isinstance(p.get("description"), str):
        raise _fail(f"{path}.description", "must be a string")
    t = p.get("type")
    if t == "integer":
        if not all(is_integer(p.get(k)) for k in ("min", "max", "default")):
            raise _fail(path, "min, max and default must be integers")
        if not p["min"] <= p["default"] <= p["max"]:
            raise _fail(path, "default must be between min and max")
    elif t == "boolean":
        if not isinstance(p.get("default"), bool):
            raise _fail(f"{path}.default", "must be true or false")
    elif t == "enum":
        values = p.get("values")
        if not _is_str_list(values) or not values:
            raise _fail(f"{path}.values", "must be a non-empty list of strings")
        if p.get("default") not in values or not isinstance(p.get("default"), str):
            raise _fail(f"{path}.default", "must be one of the values")
    else:
        raise _fail(f"{path}.type", "must be integer, boolean or enum")


def _id(p: str, v: Any) -> None:
    if not isinstance(v, str) or len(v) > 64 or not _KEBAB.fullmatch(v):
        raise _fail(p, "must be kebab case, at most 64 characters")


def _version(p: str, v: Any) -> None:
    if not is_integer(v) or v < 1:
        raise _fail(p, "must be a positive integer")


def _string(p: str, v: Any) -> None:
    if not isinstance(v, str):
        raise _fail(p, "must be a string")


def _names(p: str, v: Any) -> None:
    if not _is_object(v):
        raise _fail(p, "must be an object")
    if not isinstance(v.get("en"), str):
        raise _fail(f"{p}.en", "must be a string")
    _check_kurdish(f"{p}.ckb", v.get("ckb"))
    _check_kurdish(f"{p}.kmr", v.get("kmr"))


def _strings(p: str, v: Any) -> None:
    if not _is_str_list(v):
        raise _fail(p, "must be a list of strings")


def _layers(p: str, v: Any) -> None:
    if not _is_str_list(v) or not v or not all(_KEBAB.fullmatch(s) for s in v):
        raise _fail(p, "must be a non-empty list of kebab-case ids")


def _parameters(p: str, v: Any) -> None:
    if not _is_object(v):
        raise _fail(p, "must be an object")
    for k, d in v.items():
        _check_parameter(f"{p}.{k}", d)


def _primitives(p: str, v: Any) -> None:
    if not isinstance(v, list) or not v:
        raise _fail(p, "must be a non-empty list")
    for i, prim in enumerate(v):
        _check_primitive(f"{p}[{i}]", prim, 0)


_TOP: Final[Mapping[str, Callable[[str, Any], None]]] = {
    "id": _id,
    "version": _version,
    "category": _string,
    "names": _names,
    "aliases": _strings,
    "tags": _strings,
    "layers": _layers,
    "symmetry": _string,
    "parameters": _parameters,
    "primitives": _primitives,
}
_OPTIONAL: Final = frozenset({"aliases", "tags", "symmetry"})


def check_spec(x: Any) -> Shape:
    """Check the structure of parsed spec JSON and return it as shape data."""
    if not _is_object(x):
        raise _fail("spec", "must be a JSON object")
    for key in x:
        if key not in _TOP and key not in _DOC_FIELDS:
            raise _fail("spec", f'unknown field "{key}"')
    for key, check in _TOP.items():
        if key not in x:
            if key not in _OPTIONAL:
                raise _fail("spec", f'missing field "{key}"')
            continue
        check(key, x[key])
    return {
        "id": x["id"],
        "version": x["version"],
        "category": x["category"],
        "names": x["names"],
        "aliases": x.get("aliases", []),
        "tags": x.get("tags", []),
        "layers": x["layers"],
        "symmetry": x.get("symmetry", "none"),
        "parameters": x["parameters"],
        "primitives": x["primitives"],
    }


def variants(shape: Shape) -> list[dict[str, Any]]:
    """The parameter overrides ``validate`` renders: the defaults, then each other value."""
    out: list[dict[str, Any]] = [{}]
    for name, p in shape["parameters"].items():
        values: list[Any]
        if p["type"] == "integer":
            lo, hi = p["min"], p["max"]
            values = [lo, hi] if hi - lo > _MAX_RANGE else list(range(int(lo), int(hi) + 1))
        elif p["type"] == "boolean":
            values = [True, False]
        else:
            values = list(p["values"])
        out += [{name: v} for v in values if v != p["default"]]
    return out


def validate_spec(json_value: Any) -> tuple[str, int]:
    """Validate parsed spec JSON; return ``(id, variants rendered)``.

    Raises ``DeqError`` (``INVALID_SHAPE`` for structural problems, or the renderer's code).
    """
    try:
        shape = check_spec(json_value)
    except _InvalidError as error:
        raise DeqError("INVALID_SHAPE", str(error), (str(error),)) from None
    found = variants(shape)
    for params in found:
        prepare(shape, {"params": params})
    return shape["id"], len(found)
