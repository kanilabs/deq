"""Scenes: glyphs placed on a canvas larger than one shape (ADR 0015).

A scene is written as one SVG with one group (layer) per cell. Leet text and generated
patterns are both scenes.
"""

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Final

from . import geometry as g
from ._format import escape_xml, num
from .errors import DeqError
from .expand import expand_shape
from .options import ResolvedOptions, resolve_options
from .registry import Shape
from .svg import SvgHooks, element, svg_root

#: One shape placed in a 24 x 24 glyph cell: ``{"shape", "params"?, "transform"?}``.
GlyphPart = Mapping[str, Any]
#: A glyph: one or more shapes on the 24 x 24 grid.
Glyph = Sequence[GlyphPart]

#: The most drawing elements one scene may expand to.
MAX_SCENE_ITEMS: Final = 20_000

_SHAPE_ONLY: Final = ("rotation", "flipX", "flipY", "params", "layerColors")


@dataclass(frozen=True, slots=True)
class Cell:
    """One glyph placed in a scene; its 24 x 24 cell has its top left at (x, y)."""

    x: float
    y: float
    glyph: Glyph


@dataclass(frozen=True, slots=True)
class Scene:
    """Glyphs on a ``width`` x ``height`` canvas in grid units."""

    width: float
    height: float
    cells: tuple[Cell, ...]


@dataclass(frozen=True, slots=True)
class ResolvedSceneOptions:
    """Validated scene options."""

    render: ResolvedOptions
    colors: tuple[str, ...]


def _fail(issues: Sequence[str]) -> DeqError:
    return DeqError("INVALID_OPTIONS", f"invalid scene options: {'; '.join(issues)}", tuple(issues))


def resolve_scene_options(options: Mapping[str, Any] | None = None) -> ResolvedSceneOptions:
    """Validate scene options: render options without the per-shape ones, plus ``colors``."""
    rest = dict(options or {})
    colors = rest.pop("colors", None)
    bad = [k for k in _SHAPE_ONLY if k in rest]
    if bad:
        raise _fail([f"{k}: not available for scenes" for k in bad])
    render = resolve_options(rest)
    if colors is None:
        return ResolvedSceneOptions(render, ())
    if (
        not isinstance(colors, list | tuple)
        or not 1 <= len(colors) <= 16
        or not all(isinstance(c, str) for c in colors)
    ):
        raise _fail(["colors: must be a list of 1 to 16 colours"])
    for i, c in enumerate(colors):
        try:
            resolve_options({"color": c})
        except DeqError:
            raise _fail([f"colors.{i}: must be a CSS colour"]) from None
    return ResolvedSceneOptions(render, tuple(colors))


def glyph_shape(glyph: Glyph) -> Shape:
    """The shape description of a glyph: one ``use`` primitive per part."""
    primitives: list[dict[str, Any]] = []
    for part in glyph:
        prim: dict[str, Any] = {"type": "use", "shape": part["shape"], "layer": "glyph"}
        if "params" in part:
            prim["params"] = part["params"]
        if "transform" in part:
            prim["transform"] = part["transform"]
        primitives.append(prim)
    return {
        "id": "glyph",
        "version": 1,
        "category": "glyph",
        "names": {
            "en": "Glyph",
            "ckb": {"text": None, "status": "none"},
            "kmr": {"text": None, "status": "none"},
        },
        "aliases": [],
        "tags": [],
        "layers": ["glyph"],
        "symmetry": "none",
        "parameters": {},
        "primitives": primitives,
    }


def expand_glyph(glyph: Glyph) -> list[g.Flat]:
    """The flat geometry of a glyph in its own 24 x 24 cell."""
    return expand_shape(glyph_shape(glyph), {})


def glyph_markup(glyph: Glyph, o: ResolvedOptions) -> str:
    """The inner markup of a glyph's group, as written by :func:`scene_svg`."""
    return "".join(element(item, o) for item in expand_glyph(glyph))


def scene_svg(
    scene: Scene,
    options: Mapping[str, Any] | None = None,
    title: str = "",
    root_attrs: str = "",
) -> str:
    """Write ``scene`` as SVG, one ``<g data-layer="cN" transform="translate(x y)">`` per cell."""
    resolved = resolve_scene_options(options)
    o, colors = resolved.render, resolved.colors
    cache: dict[str, list[g.Flat]] = {}
    count = 0
    out = svg_root(o, title, SvgHooks(root_attrs=root_attrs), scene.width, scene.height)
    for i, cell in enumerate(scene.cells):
        key = json.dumps(cell.glyph, sort_keys=True)
        items = cache.get(key)
        if items is None:
            items = expand_glyph(cell.glyph)
            cache[key] = items
        count += len(items)
        if count > MAX_SCENE_ITEMS:
            msg = f"scene expands to more than {MAX_SCENE_ITEMS} elements"
            raise DeqError("LIMIT_EXCEEDED", msg)
        c = colors[i % len(colors)] if colors else None
        style = "" if c is None else f' color="{escape_xml(c)}" stroke="currentColor"'
        inner = "".join(element(item, o) for item in items)
        out += (
            f'<g data-layer="c{i + 1}" transform="translate({num(cell.x)} {num(cell.y)})"'
            f"{style}>{inner}</g>"
        )
    return f"{out}</svg>"
