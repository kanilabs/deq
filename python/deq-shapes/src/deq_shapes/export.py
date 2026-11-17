"""The core export formats, the same files as ``@0xdolan/deq-exporters`` (ADR 0011).

SVG and PDF output is byte for byte the TypeScript output; raster formats match in size and
type (each port links its own resvg and encoders). The other formats of the Node package
(components, CSS, EPS, PSD, favicon packs and so on) are only in the Node CLI.
"""

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Final, cast

from ._format import escape_xml, is_integer, js_json, js_round, js_str
from .color import BLACK, Rgba, parse_color, to_hex
from .drawing import build_drawing
from .errors import DeqError
from .pdf import write_pdf
from .raster import ICO_SIZES, MAX_RASTER, RasterFormat, encode_svg, to_ico
from .registry import Shape, get_shape
from .svg import Prepared, SvgHooks, compose_shape, prepare, svg_document

#: Every format of the Node exporters, in their order.
FORMATS: Final = (
    "svg",
    "svg-layered",
    "svg-sprite",
    "html",
    "jsx",
    "tsx",
    "vue",
    "svelte",
    "data-uri",
    "css-background",
    "css-mask",
    "pdf",
    "ai",
    "eps",
    "png",
    "jpg",
    "webp",
    "avif",
    "ico",
    "favicon",
    "psd",
    "figma",
    "spec-json",
)
#: The formats this port writes.
PORT_FORMATS: Final = ("svg", "svg-layered", "svg-sprite", "pdf", "png", "jpg", "webp", "ico")
#: Most items one export call accepts.
MAX_ITEMS: Final = 512

_NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
_PREFIX = re.compile(r"[a-z][a-z0-9-]{0,31}")
_INKSCAPE = "http://www.inkscape.org/namespaces/inkscape"
_SYMBOL_DROP = frozenset({"xmlns", "width", "height", "role", "aria-label", "aria-hidden"})
_RASTER_TYPES: Final = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}


@dataclass(frozen=True, slots=True)
class ExportFile:
    """One output file. ``name`` never contains a path."""

    name: str
    media_type: str
    data: str | bytes


@dataclass(frozen=True, slots=True)
class Resolved:
    """An item resolved into a safe file name, its shape and its geometry."""

    name: str
    shape: Shape
    options: dict[str, Any]
    prepared: Prepared


def _invalid(prefix: str, issues: list[str]) -> DeqError:
    return DeqError("INVALID_OPTIONS", f"{prefix}: {'; '.join(issues)}", tuple(issues))


def _check_name(name: str) -> str:
    if len(name) > 64 or not _NAME.fullmatch(name):
        issue = f"name: must be kebab case, at most 64 characters (got {js_json(name[:80])})"
        raise _invalid("invalid export item", [issue])
    return name


def resolve_item(
    item: str | Mapping[str, Any], defaults: Mapping[str, Any] | None = None
) -> Resolved:
    """Resolve a shape id, ``{"shape", "params", "options", "name"}`` or ``{"parts", ...}``."""
    base = dict(defaults or {})
    if isinstance(item, str):
        return resolve_item({"shape": item}, base)
    own = dict(item.get("options") or {})
    if "parts" in item:
        shape = compose_shape(item["parts"])
        options = {**base, **own, "params": {}}
        name = _check_name(item.get("name", "composition"))
        return Resolved(name, shape, options, prepare(shape, options))
    shape = get_shape(item["shape"])
    params = {
        **(base.get("params") or {}),
        **(own.get("params") or {}),
        **(item.get("params") or {}),
    }
    options = {**base, **own, "params": params}
    name = _check_name(item.get("name", shape["id"]))
    return Resolved(name, shape, options, prepare(shape, options))


def resolve_items(
    items: Sequence[str | Mapping[str, Any]], defaults: Mapping[str, Any] | None = None
) -> list[Resolved]:
    """Resolve 1 to 512 items with unique names."""
    if not 1 <= len(items) <= MAX_ITEMS:
        raise _invalid("invalid export", [f"items: give 1 to {MAX_ITEMS} items (got {len(items)})"])
    out = [resolve_item(i, defaults) for i in items]
    seen: set[str] = set()
    for r in out:
        if r.name in seen:
            issue = f"items: duplicate name {r.name}; give each item a unique `name`"
            raise _invalid("invalid export", [issue])
        seen.add(r.name)
    return out


def split_svg(svg: str) -> tuple[list[tuple[str, str]], str]:
    """Split core output into root attributes and inner markup."""
    m = re.fullmatch(r"<svg ([^>]*)>(.*)</svg>", svg, re.DOTALL)
    if not m:
        msg = "not a Deq SVG document"
        raise ValueError(msg)
    attrs: list[tuple[str, str]] = []
    source, i = m.group(1), 0
    while True:
        eq = source.find('="', i)
        end = -1 if eq == -1 else source.find('"', eq + 2)
        if end == -1:
            return attrs, m.group(2)
        attrs.append((source[i:eq].strip(), source[eq + 2 : end]))
        i = end + 1


def to_svg(r: Resolved) -> str:
    """Optimised SVG: core's output (``currentColor`` by default)."""
    return svg_document(r.prepared)


def to_layered_svg(r: Resolved) -> str:
    """SVG with one Inkscape layer per shape layer."""
    return svg_document(
        r.prepared,
        SvgHooks(
            root_attrs=f' xmlns:inkscape="{_INKSCAPE}"',
            layer_attrs=lambda layer: (
                f' id="layer-{escape_xml(layer)}" inkscape:groupmode="layer"'
                f' inkscape:label="{escape_xml(layer)}"'
            ),
        ),
    )


def to_sprite(items: Sequence[Resolved], prefix: str = "deq-") -> str:
    """An SVG sprite with one ``<symbol id="<prefix><name>">`` per item."""
    symbols = []
    for r in items:
        attrs, inner = split_svg(svg_document(r.prepared))
        kept = "".join(f' {k}="{v}"' for k, v in attrs if k not in _SYMBOL_DROP)
        symbols.append(f'<symbol id="{escape_xml(prefix + r.name)}"{kept}>{inner}</symbol>')
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:none">'
        f"{''.join(symbols)}</svg>\n"
    )


_HEAD = re.compile(r'<g id="([^"]*)" data-layer="([^"]*)"')
_COLOR_ATTR = re.compile(r' color="[^"]*"')


def to_figma_svg(r: Resolved, current_color: Rgba = BLACK) -> str:
    """SVG with concrete colours instead of ``currentColor`` and one named group per layer."""
    o = r.prepared.options
    root_rgba = parse_color(o.color, current_color)
    root = to_hex(root_rgba)

    def layer_hex(layer: str) -> str:
        return to_hex(parse_color(o.layer_colors.get(layer, o.color), root_rgba))

    svg = svg_document(r.prepared, SvgHooks(layer_attrs=lambda layer: f' id="{escape_xml(layer)}"'))
    out: list[str] = []
    i = 0
    while True:
        start = svg.find('<g id="', i)
        open_ = -1 if start == -1 else svg.find(">", start)
        close = -1 if open_ == -1 else svg.find("</g>", open_)
        if close == -1:
            break
        head = _HEAD.match(svg, start, open_)
        out.append(svg[i:start])
        if head:
            c = layer_hex(head.group(2))
            attrs = _COLOR_ATTR.sub("", svg[head.end() : open_], count=1)
            attrs = attrs.replace(' stroke="currentColor"', "", 1)
            inner = svg[open_ + 1 : close].replace("currentColor", c)
            out.append(f'<g id="{head.group(1)}" stroke="{c}"{attrs}>{inner}</g>')
        else:
            out.append(svg[start : close + 4])
        i = close + 4
    out.append(svg[i:])
    result = _COLOR_ATTR.sub("", "".join(out), count=1)
    result = re.sub(r' role="img" aria-label="[^"]*"| aria-hidden="true"', "", result, count=1)
    return result.replace("currentColor", root)


def _check_options(fmt: str, options: Mapping[str, Any]) -> None:
    if fmt not in FORMATS:
        issue = f"format: must be one of {', '.join(FORMATS)} (got {js_json(fmt[:40])})"
        raise _invalid("invalid export options", [issue])
    issues: list[str] = []
    known = {"render", "currentColor", "scales", "quality", "matte", "colorSpace", "layers"}
    known |= {"prefix", "icoSizes"}
    issues += [f"{k}: unknown option" for k in options if k not in known]
    for key in ("currentColor", "matte"):
        v = options.get(key)
        if v is not None and (not isinstance(v, str) or len(v) > 64):
            issues.append(f"{key}: must be a string of at most 64 characters")
    for key, hi, most in (("scales", 8, 8), ("icoSizes", 256, 8)):
        v = options.get(key)
        if v is None:
            continue
        if (
            not isinstance(v, list | tuple)
            or not 1 <= len(v) <= most
            or not all(is_integer(x) and 1 <= x <= hi for x in v)
        ):
            issues.append(f"{key}: must be 1 to {most} integers from 1 to {hi}")
        elif key == "scales" and len(set(v)) != len(v):
            issues.append("scales: scales must be unique")
    q = options.get("quality")
    if q is not None and not (is_integer(q) and 0 <= q <= 100):
        issues.append(f"quality: must be an integer from 0 to 100 (got {js_str(q)})")
    if options.get("colorSpace", "rgb") not in ("rgb", "cmyk"):
        issues.append('colorSpace: must be "rgb" or "cmyk"')
    if not isinstance(options.get("layers", True), bool):
        issues.append("layers: must be true or false")
    prefix = options.get("prefix", "deq-")
    if not isinstance(prefix, str) or not _PREFIX.fullmatch(prefix):
        issues.append("prefix: must match /^[a-z][a-z0-9-]{0,31}$/")
    if issues:
        raise _invalid("invalid export options", issues)


def _pixel_width(r: Resolved, scale: int) -> int:
    width = js_round(r.prepared.options.size * scale)
    if width > MAX_RASTER:
        issue = f"scales: {r.name} at {scale}x is {width} px, more than {MAX_RASTER}"
        raise _invalid("invalid export options", [issue])
    return width


def _per_item(fmt: str, r: Resolved, o: Mapping[str, Any]) -> list[ExportFile]:
    current = parse_color(o.get("currentColor") or "#000000")
    if fmt in ("svg", "svg-layered"):
        svg = to_svg(r) if fmt == "svg" else to_layered_svg(r)
        return [ExportFile(f"{r.name}.svg", "image/svg+xml", f"{svg}\n")]
    if fmt == "pdf":
        pdf = write_pdf(
            build_drawing(r.prepared, current),
            color_space=o.get("colorSpace", "rgb"),
            layers=o.get("layers", True),
        )
        return [ExportFile(f"{r.name}.pdf", "application/pdf", pdf)]
    if fmt in _RASTER_TYPES:
        svg = to_figma_svg(r, current)
        matte = parse_color(o.get("matte") or "#ffffff")
        files = []
        for scale in o.get("scales") or [1]:
            suffix = "" if scale == 1 else f"@{scale}x"
            data = encode_svg(
                svg,
                _pixel_width(r, scale),
                cast("RasterFormat", fmt),
                quality=o.get("quality"),
                matte=matte,
            )
            files.append(ExportFile(f"{r.name}{suffix}.{fmt}", _RASTER_TYPES[fmt], data))
        return files
    if fmt == "ico":
        ico = to_ico(svg_document(r.prepared), o.get("icoSizes") or ICO_SIZES)
        return [ExportFile(f"{r.name}.ico", "image/vnd.microsoft.icon", ico)]
    msg = f'format "{fmt}" is only available in the Node CLI (npx @0xdolan/deq-cli)'
    raise DeqError("INVALID_OPTIONS", msg, (msg,))


def export_shapes(
    fmt: str,
    items: Sequence[str | Mapping[str, Any]],
    options: Mapping[str, Any] | None = None,
) -> list[ExportFile]:
    """Export items to a format; file names are unique and never contain a path.

    ``options`` uses the keys of the TypeScript ``ExportOptions``: ``render``,
    ``currentColor``, ``scales``, ``quality``, ``matte``, ``colorSpace``, ``layers``,
    ``prefix`` and ``icoSizes``.
    """
    o = dict(options or {})
    _check_options(fmt, o)
    if o.get("currentColor") is not None:
        parse_color(o["currentColor"])
    if o.get("matte") is not None:
        parse_color(o["matte"])
    resolved = resolve_items(items, o.get("render") or {})
    if fmt == "svg-sprite":
        files = [
            ExportFile(
                "deq-sprite.svg", "image/svg+xml", to_sprite(resolved, o.get("prefix", "deq-"))
            )
        ]
    else:
        files = [f for r in resolved for f in _per_item(fmt, r, o)]
    # Item names are unique kebab case and scale suffixes contain "@", so file names never
    # collide here (the Node exporters also check formats that change case, like components).
    return files
