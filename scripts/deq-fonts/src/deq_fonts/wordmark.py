"""The Deq wordmark and brand lines as outlines, from the site's fonts (Phase 12, ADR 0023).

The Latin wordmark and the English lines use Noto Sans, the Sorani wordmark uses Vazirmatn; both
are SIL OFL 1.1 variable fonts shipped by Fontsource. HarfBuzz shapes each text (kerning,
Arabic joining, right-to-left order) at a fixed weight and draws the glyphs, so the brand SVGs
need no fonts and render the same in every browser, in Inkscape and in resvg.
``uv run deq-spec brand`` reads the result from ``assets/brand/wordmark.json``.
"""

from __future__ import annotations

import io
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONTS = Path("apps/site/node_modules/@fontsource-variable")
NOTO = "noto-sans/files/noto-sans-latin-wght-normal.woff2"
VAZIRMATN = "vazirmatn/files/vazirmatn-arabic-wght-normal.woff2"
LICENSE = "SIL Open Font License 1.1"


@dataclass(frozen=True)
class Line:
    """One text to outline."""

    id: str
    text: str
    font: str
    family: str
    weight: int
    direction: str = "ltr"
    script: str = "Latn"
    language: str = "en"


LINES = (
    Line("wordmark", "Deq", NOTO, "Noto Sans", 700),
    Line("wordmark-ckb", "دەق", VAZIRMATN, "Vazirmatn", 700, "rtl", "Arab", "ckb"),
    Line(
        "tagline-1",
        "Traditional Kurdish tattoo shapes",
        NOTO,
        "Noto Sans",
        400,
    ),
    Line("tagline-2", "as an open, parametric design system.", NOTO, "Noto Sans", 400),
    Line("url", "kanilabs.github.io/deq", NOTO, "Noto Sans", 500),
)


def _num(v: float) -> str:
    """Font units rounded to one decimal, without a trailing ``.0``."""
    r = round(v, 1)
    return str(int(r)) if r == int(r) else str(r)


def _ttf(path: Path) -> bytes:
    with TTFont(path, recalcTimestamp=False) as font:
        font.flavor = None
        out = io.BytesIO()
        font.save(out)
    return out.getvalue()


def outline(line: Line, data: bytes) -> dict[str, Any]:
    """The shaped text as one SVG path in font units, y down, baseline at 0, starting at x 0."""
    face = hb.Face(hb.Blob(data))
    font = hb.Font(face)
    font.set_variations({"wght": line.weight})
    buf = hb.Buffer()
    buf.add_str(line.text)
    buf.direction = line.direction
    buf.script = line.script
    buf.language = line.language
    hb.shape(font, buf, {"kern": True, "liga": True})
    missing = [i.codepoint for i in buf.glyph_infos if i.codepoint == 0]
    if missing:
        raise SystemExit(f"{line.family} has no glyph for part of {line.text!r}")
    pen = SVGPathPen(None, ntos=_num)
    bounds = BoundsPen(None)
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions, strict=True):
        flip = (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)
        font.draw_glyph_with_pen(info.codepoint, TransformPen(pen, flip))
        font.draw_glyph_with_pen(info.codepoint, TransformPen(bounds, flip))
        x += pos.x_advance
    if bounds.bounds is None:
        raise SystemExit(f"{line.text!r} draws nothing")
    extents = font.get_font_extents("ltr")
    return {
        "text": line.text,
        "family": line.family,
        "weight": line.weight,
        "direction": line.direction,
        "unitsPerEm": face.upem,
        "ascender": extents.ascender,
        "descender": extents.descender,
        "capHeight": font.get_metric_position_with_fallback(hb.OTMetricsTag.CAP_HEIGHT),
        "xHeight": font.get_metric_position_with_fallback(hb.OTMetricsTag.X_HEIGHT),
        "advance": x,
        "bbox": [round(v) for v in bounds.bounds],
        "d": pen.getCommands(),
    }


def wordmark(fonts: Path) -> str:
    """``assets/brand/wordmark.json`` as text."""
    cache: dict[str, bytes] = {}
    lines = {}
    for line in LINES:
        if line.font not in cache:
            path = fonts / line.font
            if not path.is_file():
                raise SystemExit(f"{path} is missing: run `pnpm install`")
            cache[line.font] = _ttf(path)
        lines[line.id] = outline(line, cache[line.font])
    doc = {
        "generated": "uv run deq-fonts wordmark. Do not edit.",
        "license": f"Outlines of Noto Sans and Vazirmatn, {LICENSE}.",
        "lines": lines,
    }
    return json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
