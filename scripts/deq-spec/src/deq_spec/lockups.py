"""Lockups, colourways, the animated logo and the marketing images (Phase 12, ADR 0023).

Everything here is drawn from the Dot rosette (``brand.rosette``) and the wordmark outlines in
``assets/brand/wordmark.json`` (``uv run deq-fonts wordmark``), so no file needs a font.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from deq_spec import SpecError
from deq_spec import geometry as g
from deq_spec.colors import contrast, hex_to_rgb, rgb_to_cmyk, rgb_to_hsl, rgb_to_oklch
from deq_spec.render import num
from deq_spec.spec import read_json

# Proportions, as fractions of the mark's diameter D (the rosette from grid 4 to 20).
CAP = 0.5  # Latin cap height
CKB = 0.75  # Sorani wordmark height, dots and descender included
GAP = 0.25  # mark to wordmark, horizontal
STACK_GAP = 0.2  # mark to wordmark, stacked
CLEAR = 0.25  # clear space on every side
MIN_PX = {"mark": 16, "horizontal": 120, "stacked": 64}
D = 160.0  # mark diameter in lockup files (10 px per grid unit)
UNIT = D / 16

WORDMARK = "assets/brand/wordmark.json"


@dataclass(frozen=True)
class Colorway:
    id: str
    dots: tuple[str, ...]  # one fill, or alternating fills clockwise from the top
    ring: str
    text: str
    background: str  # the surface the colourway is made for (not drawn)


@dataclass(frozen=True)
class Text:
    d: str
    bbox: tuple[float, float, float, float]
    cap: float
    upem: float


def flag_colors(root: Path) -> dict[str, str]:
    return {c["id"]: c["hex"] for c in read_json(root / "spec/flag.json")["colors"]}


def colorways(root: Path, green: str, sun: str, ink: str, green_dark: str) -> list[Colorway]:
    flag = flag_colors(root)
    return [
        Colorway("color", (green,), sun, ink, "#FFFFFF"),
        Colorway("reversed", (green_dark,), sun, "#FFFFFF", "#17181C"),
        Colorway("mono", ("currentColor",), "currentColor", "currentColor", "#FFFFFF"),
        Colorway("white", ("#FFFFFF",), "#FFFFFF", "#FFFFFF", "#17181C"),
        Colorway("flag", (flag["red"], flag["green"]), flag["yellow"], ink, "#FFFFFF"),
    ]


def texts(root: Path) -> dict[str, Text]:
    path = root / WORDMARK
    if not path.is_file():
        raise SpecError(f"{WORDMARK} is missing: run `uv run deq-fonts wordmark`")
    out = {}
    for key, line in read_json(path)["lines"].items():
        x0, y0, x1, y1 = (float(v) for v in line["bbox"])
        out[key] = Text(line["d"], (x0, y0, x1, y1), float(line["capHeight"]), line["unitsPerEm"])
    return out


def clockwise(dots: Sequence[g.Circle], cx: float = 12, cy: float = 12) -> list[g.Circle]:
    """Dots in clockwise order from the top (screen coordinates, y down)."""

    def angle(d: g.Circle) -> float:
        a = math.atan2(d.cx - cx, cy - d.cy) % math.tau
        return 0.0 if math.isclose(a, math.tau, abs_tol=1e-9) else a

    return sorted(dots, key=angle)


def place(t: Text, scale: float, x: float, y: float, fill: str) -> str:
    """A text path with its bbox's top-left corner at (x, y)."""
    tx = x - t.bbox[0] * scale
    ty = y - t.bbox[1] * scale
    return (
        f'<path fill="{fill}" transform="translate({num(round(tx, 2))} {num(round(ty, 2))}) '
        f'scale({num(round(scale, 6))})" d="{t.d}"/>'
    )


def size(t: Text, scale: float) -> tuple[float, float]:
    return ((t.bbox[2] - t.bbox[0]) * scale, (t.bbox[3] - t.bbox[1]) * scale)


def text_scale(t: Text, ckb: bool, d: float = D) -> float:
    return CKB * d / (t.bbox[3] - t.bbox[1]) if ckb else CAP * d / t.cap


def text_top(t: Text, scale: float, ckb: bool, center: float, d: float = D) -> float:
    """Top of the text bbox: Latin cap-centred on the mark, Sorani bbox-centred."""
    if ckb:
        return center - size(t, scale)[1] / 2
    baseline = center + CAP * d / 2
    return baseline + t.bbox[1] * scale


type Drawer = Callable[[tuple[float, float], float, Colorway], str]
"""Draws the mark with its centre at a point, at a size in px per grid unit, in a colourway."""


@dataclass(frozen=True)
class Lockup:
    width: float
    height: float
    body: str


def lockup(
    rosette_svg: Drawer,
    t: Text,
    way: Colorway,
    *,
    stacked: bool,
    ckb: bool,
    d: float = D,
    x: float = 0,
    y: float = 0,
) -> Lockup:
    """A lockup with its top-left corner at (x, y), the mark drawn by ``rosette_svg``."""
    unit = d / 16
    s = text_scale(t, ckb, d)
    tw, th = size(t, s)
    if stacked:
        top_text = d + STACK_GAP * d
        width = max(d, tw)
        mark = rosette_svg((x + width / 2, y + d / 2), unit, way)
        text = place(t, s, x + (width - tw) / 2, y + top_text, way.text)
        return Lockup(width, top_text + th, mark + text)
    width = d + GAP * d + tw
    top = text_top(t, s, ckb, d / 2, d)
    height = max(d, top + th)
    if ckb:
        mark = rosette_svg((x + width - d / 2, y + d / 2), unit, way)
        text = place(t, s, x, y + top, way.text)
    else:
        mark = rosette_svg((x + d / 2, y + d / 2), unit, way)
        text = place(t, s, x + d + GAP * d, y + top, way.text)
    return Lockup(width, height, mark + text)


def color_entry(name: str, hex_: str, use: str) -> dict[str, Any]:
    rgb = hex_to_rgb(hex_)
    return {
        "name": name,
        "hex": hex_.upper(),
        "rgb": list(rgb),
        "hsl": rgb_to_hsl(rgb),
        "oklch": rgb_to_oklch(rgb),
        "cmyk": rgb_to_cmyk(rgb),
        "use": use,
        "onWhite": contrast(rgb, (255, 255, 255)),
        "onDark": contrast(rgb, (0x17, 0x18, 0x1C)),
    }
