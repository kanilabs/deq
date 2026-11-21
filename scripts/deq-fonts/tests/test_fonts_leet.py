from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import pytest
import uharfbuzz as hb
from fontTools.ttLib import TTFont

from deq_fonts.leet import (
    ADVANCE,
    FAMILY,
    LAST,
    LeetScript,
    assign_leet,
    leet_codepoints_json,
    leet_css,
    leet_fonts,
    leet_table,
    load_leet,
    load_leet_codepoints,
    plan,
)
from fonts_samples import LEET


@pytest.fixture
def scripts(tmp_path: Path) -> list[LeetScript]:
    path = tmp_path / "leet.json"
    path.write_text(json.dumps(LEET), encoding="utf-8")
    return load_leet(path)


@pytest.fixture
def fonts(scripts: list[LeetScript]) -> dict[str, bytes]:
    cps = assign_leet(scripts, {})
    out = {}
    for name, tt in leet_fonts(scripts, cps, "1.002").items():
        buf = BytesIO()
        tt.save(buf)
        out[name] = buf.getvalue()
    return out


def shape(data: bytes, text: str, features: dict[str, int] | None = None) -> list[str]:
    font = hb.Font(hb.Face(data))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, features or {})
    names = [font.glyph_to_string(i.codepoint) for i in buf.glyph_infos]
    return names[::-1] if buf.direction == "rtl" else names


def test_load_leet_needs_the_file(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="deq-generator font-data"):
        load_leet(tmp_path / "nope.json")


def test_assign_in_table_order(scripts: list[LeetScript]) -> None:
    cps = assign_leet(scripts, {})
    assert cps["latin"]["A"] == {"basic": "F000", "advanced": ["F001", "F002"], "full": "F003"}
    assert cps["latin"]["B"] == {"basic": "F004", "advanced": [], "full": "F005"}
    assert cps["sorani"]["ب"]["basic"] == "F00D"
    assert assign_leet(scripts, cps) == cps


def test_assign_keeps_values_and_never_reuses(scripts: list[LeetScript]) -> None:
    cps = assign_leet(scripts, {})
    current = json.loads(json.dumps(cps))
    current["latin"]["B"]["advanced"] = []
    del current["latin"]["A"]["full"]
    current["latin"]["gone"] = {"basic": "F0FF", "advanced": [], "full": "F100"}
    out = assign_leet(scripts, current)
    assert out["latin"]["A"]["full"] == "F101"
    assert out["latin"]["gone"]["basic"] == "F0FF"
    assert out["latin"]["A"]["basic"] == "F000"


@pytest.mark.parametrize(
    "current",
    [
        {"latin": {"A": {"basic": "F000"}, "B": {"basic": "F000"}}},
        {"latin": {"A": {"basic": "E000"}}},
        {"latin": {"A": {"basic": "F900"}}},
    ],
)
def test_assign_rejects_bad_tables(scripts: list[LeetScript], current: dict) -> None:  # type: ignore[type-arg]
    with pytest.raises(ValueError, match="unique"):
        assign_leet(scripts, current)


def test_assign_fails_when_the_block_is_full(scripts: list[LeetScript]) -> None:
    with pytest.raises(ValueError, match="full"):
        assign_leet(scripts, {"old": {"x": {"basic": f"{LAST:04X}"}}})


def test_codepoints_round_trip(tmp_path: Path, scripts: list[LeetScript]) -> None:
    path = tmp_path / "leet-codepoints.json"
    assert load_leet_codepoints(path) == {}
    cps = assign_leet(scripts, {})
    path.write_text(leet_codepoints_json(cps), encoding="utf-8")
    assert load_leet_codepoints(path) == cps


def test_table(scripts: list[LeetScript]) -> None:
    text = leet_table(scripts, assign_leet(scripts, {}))
    assert "| `A` | U+F000 | U+F001, U+F002 | U+F003 |" in text
    assert "| `B` | U+F004 | none | U+F005 |" in text
    assert "## Sorani" in text


def test_plan_shares_and_aliases(scripts: list[LeetScript]) -> None:
    p = plan(scripts, assign_leet(scripts, {}))
    names = [g.name for g in p.glyphs]
    assert names[:3] == [".notdef", "space", "uni00A0"]
    assert {"uni0021", "uni0021.ar", "uni0628.alt1", "uni0041.full"} <= set(names)
    assert all(g.advance == ADVANCE for g in p.glyphs)
    assert p.cmap[ord("a")] == p.cmap[ord("A")] == "uni0041"
    assert p.cmap[ord("·")] == "uni0021"
    # A free alias of a shared character maps to the Latin glyph, which `locl` switches.
    assert p.cmap[ord("،")] == "uni0021"
    assert p.cmap[ord("ٮ")] == "uni0628"
    assert p.cmap[0xF001] == "uni0041.alt1"
    assert "sub uni0021 by uni0021.ar;" in p.fea
    assert "sub uni0031 by uni0661;" in p.fea
    assert "sub uni0041 from [uni0041.alt1 uni0041.alt2 uni0041.full];" in p.fea


def test_fonts_shape_text(fonts: dict[str, bytes]) -> None:
    assert sorted(fonts) == ["DeqLeet-Regular.otf", "DeqLeet-Regular.ttf"]
    for data in fonts.values():
        assert shape(data, "Ab!") == ["uni0041", "uni0042", "uni0021"]
        assert shape(data, "Ç") == ["uni00C7"]
        assert shape(data, "ب!1") == ["uni0628", "uni0021.ar", "uni0661"]
        assert shape(data, "") == ["uni0041.full", "uni0041.alt2"]
        assert shape(data, "AB", {"ss01": 1}) == ["uni0041.alt1", "uni0042"]
        assert shape(data, "AÇ", {"ss02": 1}) == ["uni0041.alt2", "uni00C7"]
        assert shape(data, "AB", {"ss03": 1}) == ["uni0041.full", "uni0042.full"]
        assert shape(data, "A", {"salt": 1}) == ["uni0041.alt1"]
        assert shape(data, "☃") == [".notdef"]


def test_fonts_are_monospaced(fonts: dict[str, bytes]) -> None:
    tt = TTFont(BytesIO(fonts["DeqLeet-Regular.ttf"]))
    assert tt["post"].isFixedPitch == 1
    assert tt["OS/2"].panose.bProportion == 9
    assert {adv for adv, _ in tt["hmtx"].metrics.values()} == {round(ADVANCE * 40)}
    assert tt["hhea"].lineGap == 0
    assert tt["name"].getDebugName(1) == FAMILY


def test_css() -> None:
    css = leet_css()
    assert f'font-family: "{FAMILY}";' in css
    assert "DeqLeet-Regular.woff2" in css
