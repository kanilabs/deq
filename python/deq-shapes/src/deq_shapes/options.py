"""Render options (PRD §8.1), their defaults and runtime validation.

Options use the same camelCase names as the TypeScript reference and the JSON spec, so one
options object works in every port: ``{"size": 48, "strokeWidth": 1.5, "params": {"rays": 9}}``.
"""

import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from ._format import is_number, js_str
from .errors import DeqError

#: CSS colours accepted in options: hex, named colours and colour functions with plain
#: numeric arguments. ``url(...)``, ``var(...)`` and anything that could reference external
#: content are rejected.
COLOR = re.compile(
    r"^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]{3,32}"
    r"|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([0-9a-zA-Z.,%/\s+-]{1,64}\))$"
)
LAYER = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PARAM = re.compile(r"^[a-z][a-zA-Z0-9]*$")


@dataclass(frozen=True, slots=True)
class ResolvedOptions:
    """Options after validation, with every default filled in."""

    size: float = 24
    color: str = "currentColor"
    stroke_width: float = 2
    absolute_stroke_width: bool = False
    fill: str = "none"
    fill_opacity: float = 1
    stroke_opacity: float = 1
    linecap: Literal["round", "butt", "square"] = "round"
    linejoin: Literal["round", "miter", "bevel"] = "round"
    dot_scale: float = 1
    rotation: float = 0
    flip_x: bool = False
    flip_y: bool = False
    padding: float = 0
    background: str = "none"
    layer_colors: Mapping[str, str] = field(default_factory=dict)
    title: str | None = None
    aria_label: str | None = None
    params: Mapping[str, Any] = field(default_factory=dict)


#: The documented default of every option.
DEFAULT_OPTIONS = ResolvedOptions()

Check = Callable[[Any], str | None]


def _is_full_match(pattern: re.Pattern[str], s: str) -> bool:
    # JavaScript `$` does not match before a trailing newline, Python's does.
    return pattern.match(s) is not None and not s.endswith("\n")


def _number(lo: float, hi: float, *, exclusive_lo: bool = False) -> Check:
    def check(v: Any) -> str | None:
        if not is_number(v):
            return "must be a finite number"
        if v < lo or (exclusive_lo and v == lo) or v > hi:
            return f"must be from {js_str(lo)} to {js_str(hi)} (got {js_str(v)})"
        return None

    return check


def _boolean(v: Any) -> str | None:
    return None if isinstance(v, bool) else "must be true or false"


def _color(v: Any) -> str | None:
    if not isinstance(v, str) or len(v) > 80 or not _is_full_match(COLOR, v):
        return "must be a CSS colour"
    return None


def _color_or_none(v: Any) -> str | None:
    return None if v == "none" else _color(v)


def _text(v: Any) -> str | None:
    return None if isinstance(v, str) and len(v) <= 256 else "must be text of at most 256 chars"


def _picklist(*values: str) -> Check:
    def check(v: Any) -> str | None:
        return None if v in values and isinstance(v, str) else f"must be one of {', '.join(values)}"

    return check


def params_issues(v: Any, prefix: str) -> list[str]:
    """Problems with shape parameter overrides such as ``{"rays": 9, "centerDot": False}``."""
    if not isinstance(v, Mapping):
        return [f"{prefix}: must be an object"]
    issues: list[str] = []
    for k, x in v.items():
        if not isinstance(k, str) or not _is_full_match(PARAM, k):
            issues.append(f"{prefix}.{k}: must be a parameter name")
        ok = is_number(x) or isinstance(x, bool) or (isinstance(x, str) and len(x) <= 64)
        if not ok:
            issues.append(f"{prefix}.{k}: must be a number, boolean or short text")
    if len(v) > 32:
        issues.append(f"{prefix}: at most 32 parameters")
    return issues


def _layer_colors_issues(v: Any) -> list[str]:
    if not isinstance(v, Mapping):
        return ["layerColors: must be an object"]
    issues: list[str] = []
    for k, c in v.items():
        if not isinstance(k, str) or not _is_full_match(LAYER, k):
            issues.append(f"layerColors.{k}: must be a layer id")
        if (msg := _color(c)) is not None:
            issues.append(f"layerColors.{k}: {msg}")
    if len(v) > 64:
        issues.append("layerColors: at most 64 layer colours")
    return issues


_unit = _number(0, 1)
_CHECKS: dict[str, tuple[str, Check]] = {
    "size": ("size", _number(1, 8192)),
    "color": ("color", _color),
    "strokeWidth": ("stroke_width", _number(0.05, 12)),
    "absoluteStrokeWidth": ("absolute_stroke_width", _boolean),
    "fill": ("fill", _color_or_none),
    "fillOpacity": ("fill_opacity", _unit),
    "strokeOpacity": ("stroke_opacity", _unit),
    "linecap": ("linecap", _picklist("round", "butt", "square")),
    "linejoin": ("linejoin", _picklist("round", "miter", "bevel")),
    "dotScale": ("dot_scale", _number(0.1, 4)),
    "rotation": ("rotation", _number(-3600, 3600)),
    "flipX": ("flip_x", _boolean),
    "flipY": ("flip_y", _boolean),
    "padding": ("padding", _number(0, 24)),
    "background": ("background", _color_or_none),
    "title": ("title", _text),
    "ariaLabel": ("aria_label", _text),
}
#: Every accepted option name.
OPTION_NAMES = (*_CHECKS, "layerColors", "params")


def resolve_options(options: Mapping[str, Any] | None = None) -> ResolvedOptions:
    """Validate ``options`` and fill in defaults. Raises ``DeqError`` (``INVALID_OPTIONS``)."""
    if options is None:
        options = {}
    if not isinstance(options, Mapping):
        lines = ["must be an object"]
        raise DeqError("INVALID_OPTIONS", f"invalid render options: {lines[0]}", tuple(lines))
    issues: list[str] = []
    values: dict[str, Any] = {}
    for key, value in options.items():
        if key in _CHECKS:
            attr, check = _CHECKS[key]
            if (msg := check(value)) is not None:
                issues.append(f"{key}: {msg}")
            values[attr] = value
        elif key == "layerColors":
            issues += _layer_colors_issues(value)
            values["layer_colors"] = value
        elif key == "params":
            issues += params_issues(value, "params")
            values["params"] = value
        else:
            issues.append(f"{key}: unknown option")
    if issues:
        raise DeqError(
            "INVALID_OPTIONS", f"invalid render options: {'; '.join(issues)}", tuple(issues)
        )
    return ResolvedOptions(**values)
