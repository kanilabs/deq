"""The Kurdish flag (``spec/flag.json``) as a standalone SVG, in each of its variants."""

from collections.abc import Mapping
from typing import Any

from ._data import load
from ._format import escape_xml, is_integer, js_json, num, round_half_even
from .errors import DeqError
from .geometry import star_points

FlagVariant = dict[str, Any]


def _flag() -> dict[str, Any]:
    flag: dict[str, Any] = load("shapes.json")["flag"]
    return flag


def list_flag_variants() -> list[str]:
    """Variant ids in spec order."""
    return [x["id"] for x in _flag()["variants"]]


def _invalid(lines: list[str]) -> None:
    raise DeqError("INVALID_OPTIONS", f"invalid flag options: {'; '.join(lines)}", tuple(lines))


def flag_size(variant: FlagVariant, width: int) -> tuple[int, int]:
    """The pixel size of the flag at ``width`` px for a variant."""
    h = round_half_even((width * _flag()["viewBox"][1]) / variant["crop"][1])
    return (width, int(max(1, h)))


def get_flag_variant(variant_id: str) -> FlagVariant:
    """The variant with this id; raises ``DeqError`` (``INVALID_OPTIONS``) otherwise."""
    for x in _flag()["variants"]:
        if x["id"] == variant_id:
            found: FlagVariant = x
            return found
    known = ", ".join(list_flag_variants())
    _invalid([f"variant: must be one of {known} (got {js_json(variant_id[:64])})"])
    raise AssertionError  # pragma: no cover


def _check(options: Mapping[str, Any]) -> list[str]:
    issues: list[str] = []
    for key, v in options.items():
        if key == "variant":
            if not isinstance(v, str) or len(v) > 64:
                issues.append("variant: must be text of at most 64 chars")
        elif key == "width":
            if not is_integer(v) or not 1 <= v <= 8192:
                issues.append("width: must be an integer from 1 to 8192")
        elif key == "title":
            if not isinstance(v, str) or len(v) > 256:
                issues.append("title: must be text of at most 256 chars")
        else:
            issues.append(f"{key}: unknown option")
    return issues


def render_flag(options: Mapping[str, Any] | None = None) -> str:
    """Render the Kurdish flag as a standalone SVG string.

    Options: ``variant`` (default ``full-color``), ``width`` in px (default 900) and
    ``title`` (default "Flag of Kurdistan"; ``""`` marks the image decorative).
    """
    options = options or {}
    if issues := _check(options):
        _invalid(issues)
    flag = _flag()
    variant = get_flag_variant(options.get("variant", "full-color"))
    width, height = flag_size(variant, int(options.get("width", 900)))
    x0, w = variant["crop"]
    h = flag["viewBox"][1]
    sw = variant["strokeWidth"]
    title: str = options.get("title", flag["name"])
    a11y = ' aria-hidden="true"' if title == "" else f' role="img" aria-label="{escape_xml(title)}"'

    def stroke(c: str) -> str:
        return f' fill="none" stroke="{c}" stroke-width="{num(sw)}"'

    def rect(y: float, height_: float, fill: str) -> str:
        return (
            f'<rect x="{num(x0)}" y="{num(y)}" width="{num(w)}" height="{num(height_)}"'
            f' fill="{fill}"/>'
        )

    out = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{num(width)}" height="{num(height)}"'
        f' viewBox="{num(x0)} 0 {num(w)} {num(h)}"{a11y}>'
    )
    if title != "":
        out += f"<title>{escape_xml(title)}</title>"
    if variant["field"] is not None:
        out += rect(0, h, variant["field"])
    if variant["bands"]:
        for b in flag["bands"]:
            out += rect(b["y"], b["height"], b["color"])
    sun = flag["sun"]
    cx, cy = sun["center"]
    pts = star_points(cx, cy, sun["rays"], sun["outerRadius"], sun["innerRadius"], sun["rotation"])
    points = " ".join(f"{num(x)},{num(y)}" for x, y in pts)
    if variant["sun"] is not None:
        out += f'<polygon points="{points}" fill="{variant["sun"]}"/>'
    if variant["sunOutline"] is not None:
        out += (
            f'<polygon points="{points}"{stroke(variant["sunOutline"])} stroke-linejoin="round"/>'
        )
    if variant["dividers"] is not None:
        d = "".join(f"M{num(x0)} {num(b['y'])}H{num(x0 + w)}" for b in flag["bands"] if b["y"] > 0)
        out += f'<path d="{d}"{stroke(variant["dividers"])}/>'
    if variant["frame"] is not None:
        out += (
            f'<rect x="{num(x0 + sw / 2)}" y="{num(sw / 2)}" width="{num(w - sw)}"'
            f' height="{num(h - sw)}"{stroke(variant["frame"])}/>'
        )
    return f"{out}</svg>"
