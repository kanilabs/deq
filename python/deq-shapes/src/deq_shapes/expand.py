"""Expand a shape (generators, conditions, references) into flat geometry."""

from collections.abc import Mapping
from dataclasses import dataclass, replace
from typing import Any, NoReturn

from . import geometry as g
from ._format import is_integer, is_number, js_equal, js_json, js_str, js_to_fixed
from .errors import DeqError
from .registry import Shape, get_shape

#: Deepest nesting of generators and references.
MAX_DEPTH = 6
#: Most flat items one render may produce.
MAX_FLAT = 2000

ParamValue = int | float | bool | str


def _fail(where: str, message: str) -> NoReturn:
    raise DeqError("INVALID_PARAMETER", f"{where}: {message}")


def resolve_params(shape: Shape, overrides: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Parameter defaults merged with ``overrides``, type- and range-checked."""
    decls: dict[str, Any] = shape["parameters"]
    values: dict[str, Any] = {name: decl["default"] for name, decl in decls.items()}
    for name, value in (overrides or {}).items():
        if name not in decls:
            known = ", ".join(decls) or "none"
            _fail(shape["id"], f'unknown parameter "{name}" (known: {known})')
        values[name] = value
    for name, decl in decls.items():
        v = values[name]
        if decl["type"] == "integer":
            if not is_integer(v):
                _fail(shape["id"], f'parameter "{name}" must be an integer')
            if v < decl["min"] or v > decl["max"]:
                _fail(
                    shape["id"],
                    f"{name}={js_str(v)} is outside {js_str(decl['min'])}..{js_str(decl['max'])}",
                )
        elif decl["type"] == "boolean":
            if not isinstance(v, bool):
                _fail(shape["id"], f'parameter "{name}" must be true or false')
        elif not isinstance(v, str) or v not in decl["values"]:
            _fail(shape["id"], f"{name}={js_json(v)} is not one of {', '.join(decl['values'])}")
    return values


@dataclass(frozen=True, slots=True)
class _Ctx:
    params: Mapping[str, Any]
    transform: g.Transform
    layer: str
    depth: int
    where: str
    stack: tuple[str, ...]


def _invalid(ctx: _Ctx, message: str) -> NoReturn:
    raise DeqError("INVALID_SHAPE", f"{ctx.where}: {message}")


def _count(value: Any, ctx: _Ctx) -> int:
    v = value if is_number(value) else ctx.params.get(value["param"])
    if v is None or not is_integer(v) or v < 0:
        _invalid(ctx, "count must be a non-negative integer")
    return int(v)


def _when_matches(prim: Mapping[str, Any], ctx: _Ctx) -> bool:
    for name, expected in (prim.get("when") or {}).items():
        if name not in ctx.params:
            _invalid(ctx, f'`when` uses unknown parameter "{name}"')
        actual = ctx.params[name]
        options = expected if isinstance(expected, list) else [expected]
        if not any(js_equal(o, actual) for o in options):
            return False
    return True


def _child(ctx: _Ctx, t: g.Transform) -> _Ctx:
    return replace(
        ctx, transform=g.chain(t, ctx.transform), depth=ctx.depth + 1, where=f"{ctx.where}.element"
    )


def _add(out: list[g.Flat], item: g.Flat, ctx: _Ctx) -> None:
    if len(out) >= MAX_FLAT:
        raise DeqError("LIMIT_EXCEEDED", f"{ctx.where}: expands to more than {MAX_FLAT} items")
    out.append(g.transform_flat(item, ctx.transform))


def _vec(p: Any) -> g.Vec:
    return (p[0], p[1])


def _expand_prim(prim: Mapping[str, Any], parent: _Ctx, out: list[g.Flat]) -> None:
    if parent.depth > MAX_DEPTH:
        raise DeqError("LIMIT_EXCEEDED", f"{parent.where}: nested deeper than {MAX_DEPTH}")
    if not _when_matches(prim, parent):
        return
    layer: str = prim.get("layer") or parent.layer
    if not layer:
        _invalid(parent, "no layer")
    ctx = replace(parent, layer=layer)
    kind = prim["type"]
    paint = prim.get("paint", "stroke")
    pts: tuple[g.Vec, ...]
    if kind == "line":
        pts = ((prim["x1"], prim["y1"]), (prim["x2"], prim["y2"]))
        _add(out, g.FlatPoly(pts, closed=False, layer=layer, paint="stroke"), ctx)
    elif kind == "polyline":
        pts = tuple(_vec(p) for p in prim["points"])
        _add(out, g.FlatPoly(pts, closed=False, layer=layer, paint="stroke"), ctx)
    elif kind == "polygon":
        pts = tuple(_vec(p) for p in prim["points"])
        _add(out, g.FlatPoly(pts, closed=True, layer=layer, paint=paint), ctx)
    elif kind == "rect":
        x, y, w, h = prim["x"], prim["y"], prim["width"], prim["height"]
        pts = ((x, y), (x + w, y), (x + w, y + h), (x, y + h))
        _add(out, g.FlatPoly(pts, closed=True, layer=layer, paint=paint), ctx)
    elif kind == "star":
        n = _count(prim["points"], ctx)
        if n < 2:
            _invalid(ctx, "a star needs at least 2 points")
        star = g.star_points(
            prim["cx"], prim["cy"], n, prim["outerRadius"], prim["innerRadius"], prim["rotation"]
        )
        _add(out, g.FlatPoly(tuple(star), closed=True, layer=layer, paint=paint), ctx)
    elif kind == "circle":
        item = g.FlatCircle(prim["cx"], prim["cy"], prim["r"], layer, paint, dot=False)
        _add(out, item, ctx)
    elif kind == "dot":
        item = g.FlatCircle(prim["cx"], prim["cy"], prim.get("r", 1), layer, "fill", dot=True)
        _add(out, item, ctx)
    elif kind == "arc":
        start, end = prim["start"], prim["end"]
        if not (start < end <= start + 360):
            _invalid(ctx, "arc needs start < end <= start + 360")
        arc = g.FlatArc(prim["cx"], prim["cy"], prim["r"], start, end, layer, "stroke")
        _add(out, arc, ctx)
    elif kind == "ellipse":
        ell = g.FlatEllipse(prim["cx"], prim["cy"], prim["rx"], prim["ry"], 0, layer, paint)
        _add(out, ell, ctx)
    elif kind == "path":
        _add(out, g.FlatPath(tuple(g.parse_path(prim["d"])), layer, paint), ctx)
    elif kind == "radial":
        n = _count(prim["count"], ctx)
        sweep = prim["sweep"]
        step = (sweep / n if sweep >= 360 else sweep / (n - 1)) if n > 1 else 0
        center = _vec(prim["center"])
        for i in range(n):
            t = g.rotate(prim["start"] + i * step, center)
            _expand_prim(prim["element"], _child(ctx, t), out)
    elif kind == "repeat":
        n = _count(prim["count"], ctx)
        dx: float = 0
        dy: float = 0
        if prim.get("step") is not None:
            dx, dy = prim["step"]
        elif prim.get("spread") is not None:
            if n > 1:
                dx, dy = prim["spread"][0] / (n - 1), prim["spread"][1] / (n - 1)
        else:
            _invalid(ctx, "repeat needs step or spread")
        c = (n - 1) / 2 if prim.get("align", "center") == "center" else 0
        for i in range(n):
            t = g.translate((i - c) * dx, (i - c) * dy)
            _expand_prim(prim["element"], _child(ctx, t), out)
    elif kind == "concentric":
        n = _count(prim["count"], ctx)
        for i in range(n):
            s = 1 - i * prim["scaleStep"]
            if s <= 0:
                _invalid(ctx, f"copy {i} would have scale {js_to_fixed(s, 3)}")
            _expand_prim(prim["element"], _child(ctx, g.scale(s, _vec(prim["center"]))), out)
    elif kind == "use":
        _expand_use(prim, ctx, out)


def use_transform(prim: Mapping[str, Any]) -> g.Transform:
    """The placement transform of a ``use``."""
    tr = prim.get("transform") or {}
    origin = _vec(tr.get("origin", (12, 12)))
    t = g.scale(tr.get("scale", 1), origin)
    if tr.get("rotate"):
        t = g.chain(t, g.rotate(tr["rotate"], origin))
    dx, dy = tr.get("translate", (0, 0))
    return g.chain(t, g.translate(dx, dy))


def _expand_use(prim: Mapping[str, Any], ctx: _Ctx, out: list[g.Flat]) -> None:
    if prim["shape"] in ctx.stack:
        _invalid(ctx, f"reference cycle {' -> '.join([*ctx.stack, prim['shape']])}")
    target = get_shape(prim["shape"])
    params = resolve_params(target, prim.get("params"))
    t = g.chain(use_transform(prim), ctx.transform)
    for i, sub in enumerate(target["primitives"]):
        before = len(out)
        sub_ctx = _Ctx(
            params=params,
            transform=t,
            layer=ctx.layer,
            depth=ctx.depth + 1,
            where=f"{ctx.where}->{target['id']}[{i}]",
            stack=(*ctx.stack, target["id"]),
        )
        _expand_prim(sub, sub_ctx, out)
        # Every part of a referenced shape lands in the layer of the `use`.
        for k in range(before, len(out)):
            out[k] = replace(out[k], layer=ctx.layer)


def expand_shape(shape: Shape, params: Mapping[str, Any] | None = None) -> list[g.Flat]:
    """Expand ``shape`` into flat geometry with the given parameter values."""
    values = resolve_params(shape, params)
    out: list[g.Flat] = []
    for i, prim in enumerate(shape["primitives"]):
        ctx = _Ctx(
            params=values,
            transform=g.IDENTITY,
            layer=prim.get("layer", ""),
            depth=0,
            where=f"{shape['id']}.primitives[{i}]",
            stack=(shape["id"],),
        )
        _expand_prim(prim, ctx, out)
    return out


def expand(shape_id: str, params: Mapping[str, Any] | None = None) -> list[g.Flat]:
    """Expand the catalog shape ``shape_id`` into flat geometry."""
    return expand_shape(get_shape(shape_id), params)
