from __future__ import annotations

import io
from pathlib import Path

import pytest
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from deq_fonts import cli
from deq_fonts.ui import latin_ext_a


def _font(path: Path, chars: list[int]) -> Path:
    """A minimal TrueType font with a square glyph for each character."""
    names = [".notdef", *(f"u{c:04X}" for c in chars)]
    pen = TTGlyphPen(None)
    pen.moveTo((100, 0))
    pen.lineTo((100, 500))
    pen.lineTo((400, 500))
    pen.lineTo((400, 0))
    pen.closePath()
    square = pen.glyph()
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap({c: f"u{c:04X}" for c in chars})
    fb.setupGlyf(dict.fromkeys(names, square))
    fb.setupHorizontalMetrics(dict.fromkeys(names, (500, 100)))
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({"familyName": "Sample", "styleName": "Regular"})
    fb.setupOS2()
    fb.setupPost()
    fb.save(str(path))
    return path


def test_subset_keeps_only_latin_extended_a(tmp_path: Path) -> None:
    source = _font(tmp_path / "s.ttf", [0x41, 0x130, 0x131, 0x15F, 0x1EB9])
    data = latin_ext_a(source)
    assert data[:4] == b"wOF2"
    assert sorted(TTFont(io.BytesIO(data)).getBestCmap()) == [0x130, 0x131, 0x15F]
    assert latin_ext_a(source) == data


def test_subset_needs_latin_extended_a(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="no characters"):
        latin_ext_a(_font(tmp_path / "s.ttf", [0x41]))


def test_ui_subset_write_then_check(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    source = _font(tmp_path / "s.ttf", [0x15F])
    out = tmp_path / "out" / "ui.woff2"
    args = ["ui-subset", "--source", str(source), "--out", str(out)]
    assert cli.main([*args, "--check"]) == 1
    assert "out of date" in capsys.readouterr().err
    assert cli.main(args) == 0
    assert "wrote" in capsys.readouterr().out
    assert cli.main([*args, "--check"]) == 0
    assert cli.main(args) == 0
    assert capsys.readouterr().out == ""


def test_ui_subset_needs_source(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="pnpm install"):
        cli.main(["ui-subset", "--source", str(tmp_path / "missing.woff2")])
