"""Build the Deq icon fonts with fontTools.

* ``DeqIcons-Regular.{otf,ttf,woff2}``: static, stroke width 2 (the icon default).
* ``DeqIcons[DOTS,wght].{ttf,woff2}``: variable; ``wght`` 100-900 maps to stroke widths
  0.5-3 and ``DOTS`` 50-200 scales the dot radius in percent.
* ``DeqIconsColor-Regular.{ttf,woff2}``: COLRv1 with CPAL palettes (light, dark, monochrome)
  and an OT-SVG fallback for renderers without COLRv1.

Each icon has a Private Use Area code point (``fonts/codepoints.json``) and ligatures for its
id, its aliases and its ASCII Kurmanji name, so typing ``roj`` shows the half sun.
"""

from __future__ import annotations

import math
import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any

from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.designspaceLib import (
    AxisDescriptor,
    DesignSpaceDocument,
    InstanceDescriptor,
    SourceDescriptor,
)
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.otlLib.builder import buildStatTable
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.roundingPen import RoundingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.ttLib.tables import otTables, ttProgram
from fontTools.ttLib.tables._g_l_y_f import flagOverlapSimple
from fontTools.ttLib.tables.S_V_G_ import SVGDocument, table_S_V_G_
from fontTools.varLib import build as build_variable

from deq_fonts.letters import CHARACTERS, LETTERS, NOTDEF
from deq_fonts.outline import BASELINE, SCALE, UPM, Contour, Node, draw, outline, to_font

FAMILY = "Deq Icons"
COLOR_FAMILY = "Deq Icons Color"
VENDOR = "KANI"
#: Stroke width (canvas units) of the static fonts and at each variable master.
REGULAR_STROKE = 2.0
WEIGHTS = {100: 0.5, 400: REGULAR_STROKE, 900: 3.0}
DOTS = (50, 100, 200)
INSTANCES = {
    100: "Thin",
    200: "ExtraLight",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "SemiBold",
    700: "Bold",
    800: "ExtraBold",
    900: "Black",
}
ASCENT = round(BASELINE * SCALE)
DESCENT = UPM - ASCENT
SPACE = 12
LIGATURE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
GLYPH_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9]{0,62}$")

#: Kurdish flag colours (RGBA, 0-1) and an ink colour, per palette.
PALETTES: dict[str, list[str]] = {
    "Light": ["#ED2024", "#278E43", "#FEBD11", "#1A1A1A"],
    "Dark": ["#FF5A5E", "#4CC26A", "#FEBD11", "#F2F2F2"],
    "Monochrome": ["#000000", "#000000", "#000000", "#000000"],
}
PALETTE_TYPES = [1, 2, 1]  # usable with light / dark backgrounds
#: Layer names with a fixed colour (flag and sun); other layers cycle red, green, yellow.
LAYER_COLORS = {"top": 0, "bottom": 1, "sun": 2, "frame": 3}

LICENSE = (
    "This Font Software is licensed under the GNU General Public License, version 3 or "
    "(at your option) any later version, with the GPL Font Exception: embedding this font "
    "in a document does not by itself cause the document to be covered by the GPL."
)
LICENSE_URL = "https://www.gnu.org/licenses/gpl-faq.html#FontException"
URL = "https://kanilabs.github.io/deq/"
DESCRIPTION = "Icons from traditional Kurdish tattoo (deq) motifs."


@dataclass
class Glyph:
    name: str
    advance: float
    items: Sequence[Mapping[str, Any]]
    codepoint: int | None = None
    #: Colour layers: (palette index, items), for the colour font.
    layers: list[tuple[int, list[Mapping[str, Any]]]] = field(default_factory=list)
    #: Horizontal shift of the outline in canvas units.
    offset: float = 0.0


@dataclass(frozen=True)
class Shape:
    id: str
    name: str
    kmr: str | None
    aliases: tuple[str, ...]
    flat: list[Mapping[str, Any]]

    @property
    def glyph_name(self) -> str:
        first, *rest = self.id.split("-")
        return first + "".join(w[:1].upper() + w[1:] for w in rest)

    @classmethod
    def load(cls, data: Mapping[str, Any]) -> Shape:
        return cls(
            id=data["id"],
            name=data["name"],
            kmr=data.get("kmr"),
            aliases=tuple(data.get("aliases", ())),
            flat=list(data["flat"]),
        )


def layers(flat: Sequence[Mapping[str, Any]]) -> list[tuple[int, list[Mapping[str, Any]]]]:
    """Group items by layer in drawing order and pick each layer's palette entry."""
    groups: dict[str, list[Mapping[str, Any]]] = {}
    for item in flat:
        groups.setdefault(str(item.get("layer", "")), []).append(item)
    return [
        (LAYER_COLORS.get(name, i % 3), items) for i, (name, items) in enumerate(groups.items())
    ]


def glyphs(shapes: Sequence[Shape], codepoints: Mapping[str, str]) -> list[Glyph]:
    """Every glyph in font order: .notdef, spaces, letters, then one glyph per icon."""
    out = [
        Glyph(".notdef", NOTDEF[0], NOTDEF[1]),
        Glyph("space", SPACE, [], 0x20),
        Glyph("uni00A0", SPACE, [], 0xA0),
    ]
    out += [Glyph(n, adv, items, ord(CHARACTERS[n])) for n, (adv, items) in LETTERS.items()]
    taken = {g.name for g in out}
    for shape in shapes:
        name = shape.glyph_name
        if name in taken or not GLYPH_NAME.match(name):
            raise ValueError(f"bad or duplicate glyph name: {name}")
        if shape.id not in codepoints:
            raise ValueError(f"no code point for {shape.id}: run `deq-fonts codepoints`")
        taken.add(name)
        out.append(Glyph(name, 24, shape.flat, int(codepoints[shape.id], 16), layers(shape.flat)))
    return out


def ligatures(shapes: Sequence[Shape]) -> dict[str, str]:
    """Typed text to glyph name: ids first, then aliases and ASCII Kurmanji names
    (the first shape in catalog order wins a shared name)."""
    out: dict[str, str] = {}
    for texts in (
        [(s.id, s) for s in shapes],
        [(a, s) for s in shapes for a in s.aliases],
        [(s.kmr, s) for s in shapes if s.kmr],
    ):
        for text, shape in texts:
            if LIGATURE.match(text) and text not in out:
                out[text] = shape.glyph_name
    return out


def features(ligs: Mapping[str, str]) -> str:
    """The GSUB feature code: ``liga`` and ``calt`` (some apps only apply one of them)."""
    names = {c: n for n, c in CHARACTERS.items()}
    rules = [
        f"    sub {' '.join(names[c] for c in text)} by {glyph};"
        for text, glyph in sorted(ligs.items(), key=lambda kv: (-len(kv[0]), kv[0]))
    ]
    body = "\n".join(rules)
    return (
        "languagesystem DFLT dflt;\nlanguagesystem latn dflt;\n\n"
        f"lookup icons {{\n{body}\n}} icons;\n\n"
        "feature liga { lookup icons; } liga;\nfeature calt { lookup icons; } calt;\n"
    )


def _contours(
    items: Iterable[Mapping[str, Any]], stroke: float, dots: float, offset: float = 0.0
) -> list[Contour]:
    dx = offset * SCALE
    return [[Node(n.x + dx, n.y, n.on) for n in c] for c in to_font(outline(items, stroke, dots))]


def _bounds(contours: Sequence[Contour]) -> tuple[float, float, float, float] | None:
    pen = BoundsPen(None)
    draw(contours, pen)
    return pen.bounds  # type: ignore[no-any-return]


def _names(
    family: str, style: str, version: str, postscript: str, description: str
) -> dict[str, str]:
    return {
        "copyright": "Copyright 2026 0xdolan and the Deq contributors",
        "familyName": family,
        "styleName": style,
        "uniqueFontIdentifier": f"{version};{VENDOR};{postscript}",
        "fullName": f"{family} {style}",
        "version": f"Version {version}",
        "psName": postscript,
        "manufacturer": "Kani Labs",
        "designer": "0xdolan",
        "description": description,
        "vendorURL": URL,
        "designerURL": URL,
        "licenseDescription": LICENSE,
        "licenseInfoURL": LICENSE_URL,
    }


def font(
    glyph_list: Sequence[Glyph],
    *,
    family: str,
    version: str,
    stroke: float = REGULAR_STROKE,
    dots: float = 1.0,
    cff: bool = False,
    overlaps: bool = False,
    weight: int = 400,
    cmap: Mapping[int, str] | None = None,
    leading: int = 0,
    description: str = DESCRIPTION,
) -> TTFont:
    """One static font. ``overlaps`` keeps the overlapping contours (variable masters).
    Without ``cmap`` each glyph maps its own code point, and capitals share the lowercase
    letter glyphs. ``leading`` (font units) is added half above and half below the line."""
    ascent = ASCENT + leading // 2
    descent = DESCENT + leading - leading // 2
    style = "Regular"
    postscript = f"{family.replace(' ', '')}-{style}"
    fb = FontBuilder(UPM, isTTF=not cff)
    fb.setupGlyphOrder([g.name for g in glyph_list])
    if cmap is None:
        cmap = {g.codepoint: g.name for g in glyph_list if g.codepoint is not None}
        # Capitals share the lowercase glyphs, so `Roj` and `ROJ` ligate too.
        cmap |= {
            ord(c.upper()): n for n, c in CHARACTERS.items() if c.isalpha() and n in cmap.values()
        }
    fb.setupCharacterMap(dict(cmap))
    contours = {g.name: _contours(g.items, stroke, dots, g.offset) for g in glyph_list}
    metrics: dict[str, tuple[int, int]] = {}
    for g in glyph_list:
        box = _bounds(contours[g.name])
        metrics[g.name] = (round(g.advance * SCALE), round(box[0]) if box else 0)
    if cff:
        charstrings = {}
        for g in glyph_list:
            pen = T2CharStringPen(metrics[g.name][0], None)
            draw(contours[g.name], RoundingPen(ReverseContourPen(pen)))
            charstrings[g.name] = pen.getCharString()
        fb.setupCFF(postscript, {"FullName": f"{family} {style}"}, charstrings, {})
    else:
        tt = {}
        for g in glyph_list:
            pen = TTGlyphPen(None)
            draw(contours[g.name], RoundingPen(pen))
            tt[g.name] = pen.glyph()
            if overlaps and tt[g.name].numberOfContours > 0:
                tt[g.name].flags[0] |= flagOverlapSimple
        fb.setupGlyf(tt)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ascent, descent=-descent, lineGap=0)
    fb.setupNameTable(_names(family, style, version, postscript, description))
    fb.setupOS2(
        version=4,
        achVendID=VENDOR,
        usWeightClass=weight,
        fsType=0,
        fsSelection=(1 << 6) | (1 << 7),  # REGULAR, USE_TYPO_METRICS
        sTypoAscender=ascent,
        sTypoDescender=-descent,
        sTypoLineGap=0,
        usWinAscent=ascent,
        usWinDescent=descent,
        sxHeight=round((BASELINE - 11) * SCALE),
        sCapHeight=round((BASELINE - 6) * SCALE),
        usDefaultChar=0,
        usBreakChar=0x20,
        usMaxContext=0,
    )
    fb.setupPost(keepGlyphNames=not cff)
    fb.font["head"].fontRevision = float(version)
    if not overlaps:
        removeOverlaps(fb.font)
    _finish(fb.font)
    return fb.font


def _finish(tt: TTFont) -> None:
    """Fix the metrics that depend on the final outlines."""
    os2 = tt["OS/2"]
    os2.recalcUnicodeRanges(tt)
    os2.recalcCodePageRanges(tt)
    head = tt["head"]
    if "glyf" in tt:
        tt["glyf"].compile(tt)  # recalculates the glyph bounds
        boxes = [g for g in (tt["glyf"][n] for n in tt.getGlyphOrder()) if g.numberOfContours]
        head.yMax = max(g.yMax for g in boxes)
        head.yMin = min(g.yMin for g in boxes)
    else:
        glyph_set = tt.getGlyphSet()
        ys: list[float] = []
        for name in tt.getGlyphOrder():
            pen = BoundsPen(glyph_set)
            glyph_set[name].draw(pen)
            if pen.bounds:
                ys += [pen.bounds[1], pen.bounds[3]]
        head.yMin, head.yMax = math.floor(min(ys)), math.ceil(max(ys))
    os2.usWinAscent = max(os2.sTypoAscender, head.yMax)
    os2.usWinDescent = max(-os2.sTypoDescender, -head.yMin)


#: ``prep`` program that turns on smart dropout control for unhinted TrueType outlines.
DROPOUT = "PUSHW[ ] 511 SCANCTRL[ ] PUSHB[ ] 4 SCANTYPE[ ]"


def _features(tt: TTFont, ligs: Mapping[str, str]) -> None:
    """Last step for every icon font: ligatures, then :func:`finish_tables`."""
    addOpenTypeFeaturesFromString(tt, features(ligs))
    tt["OS/2"].usMaxContext = max(len(t) for t in ligs)
    finish_tables(tt)


def finish_tables(tt: TTFont) -> None:
    """Windows-only names and, for TrueType, dropout control."""
    tt["name"].removeNames(platformID=1)
    if "glyf" in tt:
        prep = newTable("prep")
        prep.program = ttProgram.Program()
        prep.program.fromAssembly(DROPOUT)
        tt["prep"] = prep
        tt["maxp"].maxStackElements = max(tt["maxp"].maxStackElements, 1)
        gasp = newTable("gasp")
        gasp.gaspRange = {0xFFFF: 0x000F}
        tt["gasp"] = gasp


def static_fonts(
    shapes: Sequence[Shape], codepoints: Mapping[str, str], version: str
) -> dict[str, TTFont]:
    """``DeqIcons-Regular.otf`` and ``.ttf``."""
    gl = glyphs(shapes, codepoints)
    ligs = ligatures(shapes)
    out = {}
    for ext, cff in (("otf", True), ("ttf", False)):
        tt = font(gl, family=FAMILY, version=version, cff=cff)
        _features(tt, ligs)
        out[f"DeqIcons-Regular.{ext}"] = tt
    return out


#: Regular is the elidable default and links to Bold.
REGULAR_STAT = {"flags": 2, "linkedValue": 700}


def variable_font(shapes: Sequence[Shape], codepoints: Mapping[str, str], version: str) -> TTFont:
    """``DeqIcons[DOTS,wght].ttf``: masters at each weight (dots 100) and each dot scale
    (weight 400). Strokes and dots are independent, so the deltas add up exactly."""
    gl = glyphs(shapes, codepoints)
    doc = DesignSpaceDocument()
    for tag, name, values in (("wght", "Weight", sorted(WEIGHTS)), ("DOTS", "Dots", DOTS)):
        axis = AxisDescriptor()
        axis.tag, axis.name = tag, name
        axis.minimum, axis.maximum = min(values), max(values)
        axis.default = 400 if tag == "wght" else 100
        doc.addAxis(axis)
    masters = [(w, 100) for w in sorted(WEIGHTS)] + [(400, d) for d in DOTS if d != 100]
    for w, d in masters:
        src = SourceDescriptor()
        src.font = font(
            gl,
            family=FAMILY,
            version=version,
            stroke=WEIGHTS[w],
            dots=d / 100,
            overlaps=True,
            weight=w,
        )
        src.location = {"Weight": w, "Dots": d}
        src.name = f"master-{w}-{d}"
        doc.addSource(src)
    for w, style in INSTANCES.items():
        inst = InstanceDescriptor()
        inst.familyName, inst.styleName = FAMILY, style
        inst.location = {"Weight": w, "Dots": 100}
        inst.postScriptFontName = f"DeqIcons-{style}"
        doc.addInstance(inst)
    vf, _, _ = build_variable(doc)
    buildStatTable(
        vf,
        [
            {
                "tag": "wght",
                "name": "Weight",
                "ordering": 0,
                "values": [
                    {"value": w, "name": s, **(REGULAR_STAT if w == 400 else {})}
                    for w, s in INSTANCES.items()
                ],
            },
            {
                "tag": "DOTS",
                "name": "Dots",
                "ordering": 1,
                "values": [{"value": 100, "name": "Normal", "flags": 2}],
            },
        ],
        elidedFallbackName="Regular",
    )
    vf["name"].setName("DeqIcons", 25, 3, 1, 0x409)  # variations PostScript name prefix
    _features(vf, ligatures(shapes))
    return vf


def _hex(color: str) -> tuple[float, float, float, float]:
    r, g, b = (int(color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return r, g, b, 1.0


def color_font(shapes: Sequence[Shape], codepoints: Mapping[str, str], version: str) -> TTFont:
    """``DeqIconsColor-Regular.ttf``: COLRv1 layers with CPAL palettes, plus OT-SVG."""
    gl = glyphs(shapes, codepoints)
    layer_glyphs: list[Glyph] = []
    paints: dict[str, list[tuple[str, int]]] = {}
    for g in gl:
        if g.layers:
            names = [f"{g.name}.layer{i}" for i in range(len(g.layers))]
            layer_glyphs += [
                Glyph(n, g.advance, items) for n, (_, items) in zip(names, g.layers, strict=True)
            ]
            paints[g.name] = [(n, idx) for n, (idx, _) in zip(names, g.layers, strict=True)]
    tt = font([*gl, *layer_glyphs], family=COLOR_FAMILY, version=version)
    tt["COLR"] = buildCOLR(
        {
            base: {
                "Format": otTables.PaintFormat.PaintColrLayers,
                "Layers": [
                    {
                        "Format": otTables.PaintFormat.PaintGlyph,
                        "Paint": {
                            "Format": otTables.PaintFormat.PaintSolid,
                            "PaletteIndex": idx,
                            "Alpha": 1.0,
                        },
                        "Glyph": name,
                    }
                    for name, idx in layer_list
                ],
            }
            for base, layer_list in paints.items()
        },
        version=1,
    )
    tt["CPAL"] = buildCPAL(
        [[_hex(c) for c in colors] for colors in PALETTES.values()],
        paletteTypes=PALETTE_TYPES,
        paletteLabels=list(PALETTES),
        nameTable=tt["name"],
    )
    tt["SVG "] = svg_table(tt, paints)
    _features(tt, ligatures(shapes))
    return tt


def svg_table(tt: TTFont, paints: Mapping[str, Sequence[tuple[str, int]]]) -> table_S_V_G_:
    """One SVG document per colour glyph, filled with the light palette."""
    glyph_set = tt.getGlyphSet()
    colors = PALETTES["Light"]
    docs = []
    for base, layer_list in paints.items():
        gid = tt.getGlyphID(base)
        paths = []
        for name, idx in layer_list:
            pen = SVGPathPen(glyph_set)
            glyph_set[name].draw(TransformPen(pen, (1, 0, 0, -1, 0, 0)))
            paths.append(f'<path fill="{colors[idx]}" d="{pen.getCommands()}"/>')
        data = (
            f'<svg xmlns="http://www.w3.org/2000/svg"><g id="glyph{gid}">{"".join(paths)}</g></svg>'
        )
        docs.append(SVGDocument(data, gid, gid, False))
    table: table_S_V_G_ = newTable("SVG ")
    table.docList = sorted(docs, key=lambda d: d.startGlyphID)
    return table


def woff2(tt: TTFont) -> bytes:
    """The font as WOFF2."""
    buf = BytesIO()
    clone = TTFont(BytesIO(_save(tt)))
    clone.flavor = "woff2"
    clone.save(buf)
    return buf.getvalue()


def _save(tt: TTFont) -> bytes:
    buf = BytesIO()
    tt.save(buf)
    return buf.getvalue()


def write(fonts: Mapping[str, TTFont], out: Path) -> list[Path]:
    """Save fonts (and a WOFF2 of each TrueType font) to ``out``."""
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for name, tt in fonts.items():
        path = out / name
        path.write_bytes(_save(tt))
        written.append(path)
        if name.endswith(".ttf"):
            web = path.with_suffix(".woff2")
            web.write_bytes(woff2(tt))
            written.append(web)
    return written
