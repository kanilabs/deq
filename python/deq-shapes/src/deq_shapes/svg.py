"""Deterministic, accessible SVG output for shapes and compositions."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from . import geometry as g
from ._format import escape_xml, is_number, js_mod, num
from .errors import DeqError
from .expand import expand_shape
from .options import LAYER, ResolvedOptions, params_issues, resolve_options
from .registry import Shape, get_shape

#: Canvas size in grid units.
CANVAS = 24
_CENTER = CANVAS / 2


def _pts(points: Sequence[g.Vec]) -> str:
    return " ".join(f"{num(x)},{num(y)}" for x, y in points)


def is_closed(item: g.Flat) -> bool:
    """True when the item outlines an area that ``fill`` paints."""
    if isinstance(item, g.FlatPoly):
        return item.closed
    if isinstance(item, g.FlatCircle):
        return not item.dot
    if isinstance(item, g.FlatEllipse):
        return True
    if isinstance(item, g.FlatArc):
        return item.end - item.start >= 360
    return any(s[0] == "Z" for s in item.segments)


def is_filled(item: g.Flat) -> bool:
    """True when the item is painted as a solid area in the ink colour."""
    return item.paint == "fill" or (isinstance(item, g.FlatCircle) and item.dot)


def _paint_attrs(item: g.Flat, o: ResolvedOptions) -> str:
    if is_filled(item):
        op = "" if o.stroke_opacity == 1 else f' fill-opacity="{num(o.stroke_opacity)}"'
        return f' fill="currentColor"{op} stroke="none"'
    if o.fill != "none" and is_closed(item):
        op = "" if o.fill_opacity == 1 else f' fill-opacity="{num(o.fill_opacity)}"'
        return f' fill="{escape_xml(o.fill)}"{op}'
    return ""


def _circle(cx: float, cy: float, r: float) -> str:
    return f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r)}"'


def element(item: g.Flat, o: ResolvedOptions) -> str:
    """One SVG element; stroke attributes are inherited from the root."""
    paint = _paint_attrs(item, o)
    if isinstance(item, g.FlatPoly):
        if not item.closed and len(item.points) == 2:
            (x1, y1), (x2, y2) = item.points
            return f'<line x1="{num(x1)}" y1="{num(y1)}" x2="{num(x2)}" y2="{num(y2)}"/>'
        tag = "polygon" if item.closed else "polyline"
        return f'<{tag} points="{_pts(item.points)}"{paint}/>'
    if isinstance(item, g.FlatCircle):
        r = item.r * o.dot_scale if item.dot else item.r
        return f"{_circle(item.cx, item.cy, r)}{paint}/>"
    if isinstance(item, g.FlatArc):
        sweep = item.end - item.start
        if sweep >= 360:
            return f"{_circle(item.cx, item.cy, item.r)}{paint}/>"
        c0, s0 = g.cos_sin(item.start)
        c1, s1 = g.cos_sin(item.end)
        rs = num(item.r)
        large = 1 if sweep > 180 else 0
        start = f"{num(item.cx + item.r * c0)} {num(item.cy + item.r * s0)}"
        end = f"{num(item.cx + item.r * c1)} {num(item.cy + item.r * s1)}"
        return f'<path d="M{start}A{rs} {rs} 0 {large} 1 {end}"/>'
    if isinstance(item, g.FlatEllipse):
        rot = (
            ""
            if js_mod(item.rotation, 360) == 0
            else f' transform="rotate({num(item.rotation)} {num(item.cx)} {num(item.cy)})"'
        )
        return (
            f'<ellipse cx="{num(item.cx)}" cy="{num(item.cy)}" rx="{num(item.rx)}"'
            f' ry="{num(item.ry)}"{rot}{paint}/>'
        )
    d = "".join(
        seg[0] + " ".join(f"{num(p[0])} {num(p[1])}" for p in seg[1:]) for seg in item.segments
    )
    return f'<path d="{d}"{paint}/>'


@dataclass(frozen=True, slots=True)
class SvgHooks:
    """Hooks for :func:`svg_document`, used by exporters that need named layer groups."""

    #: Extra attributes on the root ``<svg>``, starting with a space.
    root_attrs: str = ""
    #: Extra attributes for the group of a layer, starting with a space. When given, every
    #: layer gets its own group and the rotation/flip transform moves onto each group.
    layer_attrs: Callable[[str], str] | None = None


def _body(items: Sequence[g.Flat], o: ResolvedOptions, hooks: SvgHooks) -> str:
    transform = _group_transform(o)
    layer_attrs = hooks.layer_attrs
    if not o.layer_colors and layer_attrs is None:
        inner = "".join(element(item, o) for item in items)
        return f'<g transform="{transform}">{inner}</g>' if transform else inner
    # Group by layer in first-use order so each layer can carry its own colour.
    layers: dict[str, list[str]] = {}
    for item in items:
        layers.setdefault(item.layer, []).append(element(item, o))
    out = ""
    for layer, elements in layers.items():
        c = o.layer_colors.get(layer)
        # Re-declare stroke: SVG 1.1 renderers resolve currentColor where it is declared.
        style = "" if c is None else f' color="{escape_xml(c)}" stroke="currentColor"'
        inner = "".join(elements)
        if layer_attrs is not None:
            t = f' transform="{transform}"' if transform else ""
            out += f'<g{layer_attrs(layer)} data-layer="{escape_xml(layer)}"{style}{t}>{inner}</g>'
        else:
            out += f'<g data-layer="{escape_xml(layer)}"{style}>{inner}</g>'
    if layer_attrs is None and transform:
        return f'<g transform="{transform}">{out}</g>'
    return out


def _group_transform(o: ResolvedOptions) -> str:
    parts: list[str] = []
    if js_mod(o.rotation, 360) != 0:
        parts.append(f"rotate({num(o.rotation)} {num(_CENTER)} {num(_CENTER)})")
    if o.flip_x or o.flip_y:
        fx = num(CANVAS) if o.flip_x else "0"
        fy = num(CANVAS) if o.flip_y else "0"
        parts.append(f"translate({fx} {fy})")
        parts.append(f"scale({'-1' if o.flip_x else '1'} {'-1' if o.flip_y else '1'})")
    return " ".join(parts)


@dataclass(frozen=True, slots=True)
class Prepared:
    """A shape ready to draw: resolved options and flat geometry in canvas units."""

    options: ResolvedOptions
    items: tuple[g.Flat, ...]
    #: The layer ids of the shape, in declaration order.
    layers: tuple[str, ...]
    #: The title used when ``options.title`` is not set (the English name).
    default_title: str


def svg_root(
    o: ResolvedOptions,
    default_title: str,
    hooks: SvgHooks | None = None,
    width: float = CANVAS,
    height: float = CANVAS,
) -> str:
    """The root ``<svg>`` with title and background for a ``width`` x ``height`` canvas."""
    hooks = hooks or SvgHooks()
    box = CANVAS + 2 * o.padding
    w = width + 2 * o.padding
    h = height + 2 * o.padding
    stroke = (o.stroke_width * box) / o.size if o.absolute_stroke_width else o.stroke_width
    title = o.title if o.title is not None else default_title
    label = o.aria_label if o.aria_label is not None else title
    a11y = (
        ' aria-hidden="true"'
        if title == "" and label == ""
        else f' role="img" aria-label="{escape_xml(label)}"'
    )
    color = "" if o.color == "currentColor" else f' color="{escape_xml(o.color)}"'
    opacity = "" if o.stroke_opacity == 1 else f' stroke-opacity="{num(o.stroke_opacity)}"'
    pad = num(-o.padding)
    vb = f"{pad} {pad} {num(w)} {num(h)}"
    pw = o.size if width == CANVAS else (o.size * w) / box
    ph = o.size if height == CANVAS else (o.size * h) / box
    out = (
        f'<svg xmlns="http://www.w3.org/2000/svg"{hooks.root_attrs} width="{num(pw)}"'
        f' height="{num(ph)}" viewBox="{vb}" fill="none" stroke="currentColor"'
        f' stroke-width="{num(stroke)}" stroke-linecap="{o.linecap}"'
        f' stroke-linejoin="{o.linejoin}"{color}{opacity}{a11y}>'
    )
    if title != "":
        out += f"<title>{escape_xml(title)}</title>"
    if o.background != "none":
        out += (
            f'<rect x="{pad}" y="{pad}" width="{num(w)}" height="{num(h)}"'
            f' fill="{escape_xml(o.background)}" stroke="none"/>'
        )
    return out


def svg_document(p: Prepared, hooks: SvgHooks | None = None) -> str:
    """The SVG document for prepared geometry; with no hooks exactly what :func:`render` gives."""
    hooks = hooks or SvgHooks()
    return f"{svg_root(p.options, p.default_title, hooks)}{_body(p.items, p.options, hooks)}</svg>"


def _check_layers(shape: Shape, o: ResolvedOptions) -> None:
    unknown = [layer for layer in o.layer_colors if layer not in shape["layers"]]
    if unknown:
        issues = tuple(
            f"layerColors.{layer}: not a layer of {shape['id']} ({', '.join(shape['layers'])})"
            for layer in unknown
        )
        raise DeqError("INVALID_OPTIONS", f"invalid render options: {'; '.join(issues)}", issues)


def prepare(shape: Shape, options: Mapping[str, Any] | None = None) -> Prepared:
    """Validate ``options`` for ``shape`` and expand its geometry."""
    o = resolve_options(options)
    _check_layers(shape, o)
    return Prepared(
        options=o,
        items=tuple(expand_shape(shape, o.params)),
        layers=tuple(shape["layers"]),
        default_title=shape["names"]["en"],
    )


def render_shape_data(shape: Shape, options: Mapping[str, Any] | None = None) -> str:
    """Render a shape description (already validated) to an SVG string."""
    return svg_document(prepare(shape, options))


def render(shape_id: str, options: Mapping[str, Any] | None = None) -> str:
    """Render the catalog shape ``shape_id`` as a standalone SVG string.

    >>> svg = render("roj-half-sun", {"size": 48, "color": "#ED2024", "params": {"rays": 9}})
    """
    return render_shape_data(get_shape(shape_id), options)


def _vec_issue(v: Any) -> bool:
    return not (isinstance(v, list | tuple) and len(v) == 2 and all(is_number(x) for x in v))


def _part_issues(i: int, part: Any) -> list[str]:
    at = str(i)
    if not isinstance(part, Mapping):
        return [f"{at}: must be an object"]
    issues: list[str] = []
    for key in part:
        if key not in ("shape", "params", "transform", "layer"):
            issues.append(f"{at}.{key}: unknown field")
    shape = part.get("shape")
    if not isinstance(shape, str) or len(shape) > 64:
        issues.append(f"{at}.shape: must be a shape id")
    if "params" in part:
        issues += params_issues(part["params"], f"{at}.params")
    if "layer" in part:
        layer = part["layer"]
        if not isinstance(layer, str) or not LAYER.match(layer) or layer.endswith("\n"):
            issues.append(f"{at}.layer: must be a layer id")
    if "transform" in part:
        tr = part["transform"]
        if not isinstance(tr, Mapping):
            return [*issues, f"{at}.transform: must be an object"]
        for key, v in tr.items():
            where = f"{at}.transform.{key}"
            if key in ("translate", "origin"):
                if _vec_issue(v):
                    issues.append(f"{where}: must be [x, y]")
            elif key == "scale":
                if not is_number(v) or not 0 < v <= 4:
                    issues.append(f"{where}: must be above 0 and at most 4")
            elif key == "rotate":
                if not is_number(v) or not -360 <= v <= 360:
                    issues.append(f"{where}: must be from -360 to 360")
            else:
                issues.append(f"{where}: unknown field")
    return issues


def compose_shape(parts: Sequence[Mapping[str, Any]]) -> Shape:
    """The shape description of a composition: one ``use`` per part, each on its own layer."""
    issues: list[str] = []
    if not isinstance(parts, list | tuple) or not 1 <= len(parts) <= 64:
        issues.append("must be a list of 1 to 64 parts")
    else:
        for i, part in enumerate(parts):
            issues += _part_issues(i, part)
    if issues:
        raise DeqError(
            "INVALID_OPTIONS", f"invalid composition: {'; '.join(issues)}", tuple(issues)
        )
    primitives: list[dict[str, Any]] = []
    for p in parts:
        get_shape(p["shape"])
        use: dict[str, Any] = {
            "type": "use",
            "shape": p["shape"],
            "layer": p.get("layer", p["shape"]),
        }
        if p.get("params") is not None:
            use["params"] = p["params"]
        if p.get("transform") is not None:
            use["transform"] = p["transform"]
        primitives.append(use)
    return {
        "id": "composition",
        "version": 1,
        "category": "composition",
        "names": {
            "en": "Composition",
            "ckb": {"text": None, "status": "none"},
            "kmr": {"text": None, "status": "none"},
        },
        "aliases": [],
        "tags": [],
        "layers": list(dict.fromkeys(p["layer"] for p in primitives)),
        "symmetry": "none",
        "parameters": {},
        "primitives": primitives,
    }


def compose(parts: Sequence[Mapping[str, Any]], options: Mapping[str, Any] | None = None) -> str:
    """Render several catalog shapes placed on one 24 x 24 canvas (``params`` is ignored)."""
    return render_shape_data(compose_shape(parts), {**(options or {}), "params": {}})
