from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
import uharfbuzz as hb
from fontTools.ttLib import TTFont

from deq_fonts.build import (
    COLOR_FAMILY,
    FAMILY,
    PALETTES,
    Shape,
    color_font,
    features,
    glyphs,
    layers,
    ligatures,
    static_fonts,
    variable_font,
    woff2,
    write,
)
from fonts_samples import CODEPOINTS, SHAPES


def shape_glyphs(data: bytes, text: str, variations: dict[str, float] | None = None) -> list[str]:
    font = hb.Font(hb.Face(data))
    if variations:
        font.set_variations(variations)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {})
    return [font.glyph_to_string(i.codepoint) for i in buf.glyph_infos]


def save(tt: TTFont) -> bytes:
    out = BytesIO()
    tt.save(out)
    return out.getvalue()


def test_layers_pick_palette_entries() -> None:
    flat = [{"layer": "a"}, {"layer": "sun"}, {"layer": "a"}, {"layer": "b"}, {"layer": "frame"}]
    assert [(i, len(items)) for i, items in layers(flat)] == [(0, 2), (2, 1), (2, 1), (3, 1)]


def test_glyphs_order_and_errors() -> None:
    gl = glyphs(SHAPES, CODEPOINTS)
    assert [g.name for g in gl[:4]] == [".notdef", "space", "uni00A0", "a"]
    assert [g.name for g in gl[-2:]] == ["rojHalfSun", "ringDot"]
    assert gl[-1].codepoint == 0xE001
    with pytest.raises(ValueError, match="no code point for ring-dot"):
        glyphs(SHAPES, {"roj-half-sun": "E000"})
    with pytest.raises(ValueError, match="duplicate glyph name: rojHalfSun"):
        glyphs([SHAPES[0], SHAPES[0]], CODEPOINTS)
    clash = Shape("a", "A", None, (), [])
    with pytest.raises(ValueError, match="glyph name: a"):
        glyphs([clash], {"a": "E000"})


def test_ligatures_prefer_ids_then_aliases_then_kurmanji() -> None:
    ligs = ligatures(SHAPES)
    assert ligs == {
        "roj-half-sun": "rojHalfSun",
        "ring-dot": "ringDot",
        "sun": "rojHalfSun",
        "roj": "rojHalfSun",
    }
    fea = features(ligs)
    assert "sub r o j hyphen h a l f hyphen s u n by rojHalfSun;" in fea
    assert "feature liga { lookup icons; } liga;" in fea
    assert "feature calt { lookup icons; } calt;" in fea


def test_static_fonts() -> None:
    fonts = static_fonts(SHAPES, CODEPOINTS, "1.002")
    assert set(fonts) == {"DeqIcons-Regular.otf", "DeqIcons-Regular.ttf"}
    for name, tt in fonts.items():
        data = save(tt)
        assert tt["name"].getDebugName(1) == FAMILY
        assert not [n for n in tt["name"].names if n.platformID == 1]
        assert tt["head"].fontRevision == pytest.approx(1.002)
        assert tt["OS/2"].usWinDescent >= -tt["head"].yMin
        assert tt["OS/2"].usWinAscent >= tt["head"].yMax
        assert shape_glyphs(data, "roj") == ["rojHalfSun"]
        assert shape_glyphs(data, "ROJ") == ["rojHalfSun"]
        assert shape_glyphs(data, "a sun") == ["a", "space", "rojHalfSun", "ringDot"]
        if name.endswith(".ttf"):
            assert "prep" in tt
            assert "gasp" in tt
        else:
            assert "CFF " in tt
            assert "prep" not in tt


def test_variable_font() -> None:
    vf = variable_font(SHAPES, CODEPOINTS, "1.002")
    axes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in vf["fvar"].axes}
    assert axes == {"wght": (100, 400, 900), "DOTS": (50, 100, 200)}
    assert len(vf["fvar"].instances) == 9
    assert "STAT" in vf
    assert "gvar" in vf
    assert vf["name"].getDebugName(25) == "DeqIcons"
    data = save(vf)
    assert shape_glyphs(data, "roj", {"wght": 900, "DOTS": 200}) == ["rojHalfSun"]

    def width(variations: dict[str, float]) -> float:
        font = hb.Font(hb.Face(data))
        font.set_variations(variations)
        ext = font.get_glyph_extents(font.get_nominal_glyph(ord("l")))
        return float(ext.width)

    assert width({"wght": 100}) < width({"wght": 400}) < width({"wght": 900})


def test_color_font() -> None:
    tt = color_font(SHAPES, CODEPOINTS, "1.002")
    assert tt["name"].getDebugName(1) == COLOR_FAMILY
    assert tt["COLR"].version == 1
    assert len(tt["CPAL"].palettes) == len(PALETTES)
    assert tt["CPAL"].paletteTypes == [1, 2, 1]
    assert {"rojHalfSun.layer0", "rojHalfSun.layer2", "ringDot.layer0"} <= set(tt.getGlyphOrder())
    docs = tt["SVG "].docList
    assert [d.startGlyphID for d in docs] == sorted(d.startGlyphID for d in docs)
    assert 'fill="#FEBD11"' in docs[0].data  # the sun layer
    assert not [n for n in tt["name"].names if n.platformID == 1]
    assert shape_glyphs(save(tt), "roj") == ["rojHalfSun"]


def test_write_adds_woff2_for_truetype(tmp_path: Path) -> None:
    fonts = static_fonts(SHAPES, CODEPOINTS, "1.000")
    paths = write(fonts, tmp_path / "out")
    assert sorted(p.name for p in paths) == [
        "DeqIcons-Regular.otf",
        "DeqIcons-Regular.ttf",
        "DeqIcons-Regular.woff2",
    ]
    web = TTFont(tmp_path / "out" / "DeqIcons-Regular.woff2")
    assert web.flavor == "woff2"
    assert woff2(fonts["DeqIcons-Regular.ttf"])[:4] == b"wOF2"
