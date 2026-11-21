from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

from deq_fonts import cli, wordmark


def _font(path: Path, chars: set[int], *, empty: bool = False) -> Path:
    """A minimal TrueType font with a 300 x 500 square (or nothing) for each character."""
    names = [".notdef", *(f"u{c:04X}" for c in sorted(chars))]
    pen = TTGlyphPen(None)
    pen.moveTo((100, 0))
    pen.lineTo((100, 500))
    pen.lineTo((400, 500))
    pen.lineTo((400, 0))
    pen.closePath()
    square = TTGlyphPen(None).glyph() if empty else pen.glyph()
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap({c: f"u{c:04X}" for c in chars})
    fb.setupGlyf(dict.fromkeys(names, square))
    fb.setupHorizontalMetrics(dict.fromkeys(names, (500, 100)))
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({"familyName": "Sample", "styleName": "Regular"})
    fb.setupOS2(sCapHeight=700, sxHeight=500)
    fb.setupPost()
    path.parent.mkdir(parents=True, exist_ok=True)
    fb.save(str(path))
    return path


def _fonts(root: Path) -> Path:
    chars = {ord(c) for line in wordmark.LINES for c in line.text}
    first = _font(root / wordmark.NOTO, chars)
    (root / wordmark.VAZIRMATN).parent.mkdir(parents=True)
    shutil.copy(first, root / wordmark.VAZIRMATN)
    return root


def test_outline_ltr_and_rtl(tmp_path: Path) -> None:
    data = wordmark._ttf(_font(tmp_path / "s.ttf", {0x41, 0x42}))
    ltr = wordmark.outline(wordmark.Line("t", "AB", "", "Sample", 400), data)
    assert ltr["advance"] == 1000
    assert ltr["bbox"] == [100, -500, 900, 0]
    assert ltr["capHeight"] == 700
    assert ltr["d"] == "M100 0V-500H400V0H100ZM600 0V-500H900V0H600Z"
    rtl = wordmark.outline(wordmark.Line("t", "AB", "", "Sample", 400, "rtl", "Arab", "ckb"), data)
    assert rtl["advance"] == 1000
    with pytest.raises(SystemExit, match="no glyph"):
        wordmark.outline(wordmark.Line("t", "AZ", "", "Sample", 400), data)
    with pytest.raises(SystemExit, match="draws nothing"):
        wordmark.outline(
            wordmark.Line("t", " ", "", "Sample", 400),
            wordmark._ttf(_font(tmp_path / "b.ttf", {0x20}, empty=True)),
        )


def test_wordmark_command(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    fonts = _fonts(tmp_path / "fonts")
    out = tmp_path / "brand" / "wordmark.json"
    args = ["wordmark", "--fonts", str(fonts), "--out", str(out)]
    assert cli.main([*args, "--check"]) == 1
    assert "out of date" in capsys.readouterr().err
    assert cli.main(args) == 0
    assert "wrote" in capsys.readouterr().out
    assert cli.main([*args, "--check"]) == 0
    doc = json.loads(out.read_text(encoding="utf-8"))
    assert set(doc["lines"]) == {line.id for line in wordmark.LINES}
    assert doc["lines"]["wordmark-ckb"]["direction"] == "rtl"


def test_wordmark_needs_fonts(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="pnpm install"):
        cli.main(["wordmark", "--fonts", str(tmp_path), "--out", str(tmp_path / "w.json")])
