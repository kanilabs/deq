"""deq-shapes: the Deq shapes for Python.

A port of the ``@0xdolan/deq-core`` reference renderer that produces the same SVG byte for
byte (ADR 0008), plus the core export formats and the ``deq`` command line tool.

>>> from deq_shapes import render
>>> svg = render("roj-half-sun", {"size": 48, "color": "#ED2024", "params": {"rays": 9}})
"""

from typing import Final

from .errors import DeqError, DeqErrorCode
from .expand import MAX_DEPTH, MAX_FLAT, expand, expand_shape, resolve_params
from .flag import flag_size, list_flag_variants, render_flag
from .leet import DecodedLeet, LeetResult, decode_leet, detect_script, leet, leet_table, normalize
from .options import DEFAULT_OPTIONS, ResolvedOptions, resolve_options
from .patterns import PatternResult, pattern
from .registry import get_shape, has_shape, list_categories, list_shapes, suggest
from .rng import Random
from .scene import Cell, Scene, scene_svg
from .svg import (
    CANVAS,
    Prepared,
    SvgHooks,
    compose,
    compose_shape,
    prepare,
    render,
    render_shape_data,
    svg_document,
    svg_root,
)

__all__ = [
    "CANVAS",
    "DEFAULT_OPTIONS",
    "DISTRIBUTION_NAME",
    "MAX_DEPTH",
    "MAX_FLAT",
    "Cell",
    "DecodedLeet",
    "DeqError",
    "DeqErrorCode",
    "LeetResult",
    "PatternResult",
    "Prepared",
    "Random",
    "ResolvedOptions",
    "Scene",
    "SvgHooks",
    "__version__",
    "compose",
    "compose_shape",
    "decode_leet",
    "detect_script",
    "expand",
    "expand_shape",
    "flag_size",
    "get_shape",
    "has_shape",
    "leet",
    "leet_table",
    "list_categories",
    "list_flag_variants",
    "list_shapes",
    "normalize",
    "pattern",
    "prepare",
    "render",
    "render_flag",
    "render_shape_data",
    "resolve_options",
    "resolve_params",
    "scene_svg",
    "suggest",
    "svg_document",
    "svg_root",
]

__version__: Final = "0.0.0"
DISTRIBUTION_NAME: Final = "deq-shapes"
