from __future__ import annotations

import json
from pathlib import Path

import pytest

from deq_fonts.web import LAST, assign, codepoints_json, css, load_codepoints, table
from fonts_samples import CODEPOINTS, SHAPES


def test_assign_keeps_existing_and_never_reuses() -> None:
    current = {"old": "E000", "gone": "E005"}
    assert assign(["new", "old", "next"], current) == {
        "old": "E000",
        "gone": "E005",
        "new": "E006",
        "next": "E007",
    }
    assert assign(["a", "b"], {}) == {"a": "E000", "b": "E001"}


@pytest.mark.parametrize(
    ("current", "message"),
    [
        ({"a": "E000", "b": "E000"}, "unique"),
        ({"a": "0041"}, "U\\+E000"),
        ({"a": f"{LAST:04X}"}, "full"),
    ],
)
def test_assign_errors(current: dict[str, str], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        assign(["a", "new"], current)


def test_codepoints_json_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "codepoints.json"
    assert load_codepoints(path) == {}
    path.write_text(codepoints_json({"a": "E000"}), encoding="utf-8")
    assert load_codepoints(path) == {"a": "E000"}
    assert "never change or reuse" in json.loads(path.read_text("utf-8"))["description"]


def test_css() -> None:
    text = css(SHAPES, CODEPOINTS)
    assert text.startswith("/* Deq icon fonts. Generated")
    assert '.deq-roj-half-sun::before {\n  content: "\\e000";\n}' in text
    assert 'font-family: "Deq Icons Color";' in text
    assert "font-weight: 100 900;" in text


def test_table() -> None:
    text = table(SHAPES, CODEPOINTS)
    assert "| U+E000 | Half sun | `.deq-roj-half-sun` | `roj-half-sun`, `sun`, `roj` |" in text
    assert "| U+E001 | Ring | `.deq-ring-dot` | `ring-dot` |" in text
