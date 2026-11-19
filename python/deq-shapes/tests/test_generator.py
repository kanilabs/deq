"""The Leet and pattern generator port (ADR 0015): fixtures, decoding, options and limits."""

import json
import math
from pathlib import Path
from typing import Any

import pytest

from deq_shapes import (
    DeqError,
    Random,
    Scene,
    _trig,
    decode_leet,
    detect_script,
    leet,
    leet_table,
    normalize,
    pattern,
    scene_svg,
)
from deq_shapes.leet import MAX_DECODE_INPUT, entry_of
from deq_shapes.scene import Cell, resolve_scene_options

LEET = Path(__file__).resolve().parents[3] / "spec" / "fixtures" / "leet"
MANIFEST = json.loads((LEET / "manifest.json").read_text(encoding="utf-8"))
CASES = MANIFEST["cases"]
OWN = {"level", "script", "seed", "letterSpacing", "lineSpacing", "align"}


def _svg(case: dict[str, Any]) -> str:
    if "leet" in case:
        return leet(case["leet"]["text"], case["leet"].get("options")).svg
    return pattern(case["pattern"]).svg


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_fixture(case: dict[str, Any]) -> None:
    want = (LEET / case["file"]).read_text(encoding="utf-8")
    assert _svg(case) == want
    if "decoded" in case:
        render = {k: v for k, v in case["leet"].get("options", {}).items() if k not in OWN}
        assert decode_leet(want, render).text == case["decoded"]


def test_random_vectors() -> None:
    r = Random(1)
    assert [r.next(), r.next(), r.next()] == [2693262067, 11749833, 2265367787]
    z = Random(0)
    assert [z.next(), z.next()] == [1144304738, 1416247]
    assert Random(0xFFFFFFFF).next() == 3850105811
    assert Random(5).below(1) == 0
    assert Random(5).pick(["a"]) == "a"


# Math.sin and Math.cos in V8 (fdlibm), which the C library does not always match.
V8 = [
    (4.1887902047863905, -0.8660254037844385, -0.5000000000000004),
    (-4.1887902047863905, 0.8660254037844385, -0.5000000000000004),
    (1.5707963267948966, 1, 6.123233995736766e-17),
    (-1.5707963267948966, -1, 6.123233995736766e-17),
    (2, 0.9092974268256817, -0.4161468365471424),
    (-2, -0.9092974268256817, -0.4161468365471424),
    (1e-9, 1e-9, 1),
    (0.5, 0.479425538604203, 0.8775825618903728),
    (0.7, 0.644217687237691, 0.7648421872844885),
    (50, -0.26237485370392877, 0.9649660284921133),
    (157.07963267948966, 9.82193361864236e-16, 1),
    (48.69468613064179, -1, -3.674559378078648e-15),
    (-48.69468613064179, 1, -3.674559378078648e-15),
    (62.83185307179586, -2.4492935982947065e-15, 1),
    (10000000, 0.4205477931907825, -0.9072703861817396),
    (-10000000, -0.4205477931907825, -0.9072703861817396),
    (1234.5678, 0.07803344920002027, -0.9969507414140119),
]


@pytest.mark.parametrize(("x", "s", "c"), V8)
def test_trig_matches_v8(x: float, s: float, c: float) -> None:
    assert _trig.sin(x) == s
    assert _trig.cos(x) == c


def test_trig_large_arguments_fall_back() -> None:
    assert _trig.sin(1e300) == math.sin(1e300)
    assert _trig.cos(1e300) == math.cos(1e300)


def test_tables_and_script() -> None:
    assert leet_table("sorani").direction == "rtl"
    assert entry_of("latin", "A") is not None
    assert entry_of("latin", "\u2603") is None
    assert detect_script("\u0628") == "sorani"
    assert detect_script("abc") == "latin"


def test_normalize() -> None:
    norm = normalize("  ab\u200b \r\n\r\n c\u2603d \n\n", "latin")
    assert norm.text == "AB\n\nCD"
    assert norm.unknown == ("\u2603",)
    with pytest.raises(DeqError, match="longer than 1024"):
        normalize("a" * 1025, "latin")
    with pytest.raises(DeqError, match="more than 256 glyphs"):
        normalize("a" * 257, "latin")
    with pytest.raises(DeqError, match="more than 32 lines"):
        normalize("a\n" * 33, "latin")


def test_leet_result_and_layout() -> None:
    r = leet("Hi \u2603", {"align": "center"})
    assert (r.text, r.script, r.level, r.unknown) == ("HI", "latin", "basic", ("\u2603",))
    end = leet("ab\nc", {"align": "end"})
    assert end.scene.cells[2].x == 26
    rtl = leet("\u0628\u0627\n\u0628", {"align": "end"})
    assert rtl.scene.cells[2].x == 0


@pytest.mark.parametrize(
    ("options", "message"),
    [
        ({"level": "loud"}, "level: must be one of basic, advanced, full"),
        ({"seed": -1}, "seed: must be from 0 to 4294967295"),
        ({"seed": 1.5}, "seed: must be an integer"),
        ({"letterSpacing": 25}, "letterSpacing: must be from 0 to 24"),
        ({"rotation": 90}, "rotation: not available for scenes"),
        ({"colors": []}, "colors: must be a list of 1 to 16 colours"),
        ({"colors": ["#zz"]}, "colors.0: must be a CSS colour"),
    ],
)
def test_leet_bad_options(options: dict[str, Any], message: str) -> None:
    with pytest.raises(DeqError, match=message) as err:
        leet("A", options)
    assert err.value.code == "INVALID_OPTIONS"


def test_leet_bad_text() -> None:
    with pytest.raises(DeqError, match="text must be a string"):
        leet(5)  # type: ignore[arg-type]
    with pytest.raises(DeqError, match="no characters of the latin table"):
        leet("\u2603 ")


def test_decode_errors() -> None:
    with pytest.raises(DeqError, match="larger than") as big:
        decode_leet("x" * (MAX_DECODE_INPUT + 1))
    assert big.value.code == "LIMIT_EXCEEDED"
    with pytest.raises(DeqError, match="not Deq Leet SVG"):
        decode_leet("<svg/>")
    with pytest.raises(DeqError, match="advances out of range"):
        decode_leet('<svg data-deq-leet="latin basic 0 30">')


def _group(x: str, y: str, inner: str = "") -> str:
    return f'<g data-layer="c1" transform="translate({x} {y})">{inner}</g>'


def test_decode_unmatched_and_caps() -> None:
    head = '\n <svg data-deq-leet="latin basic 26 30">'
    far = head + _group("0", "0") + _group("99999999", "0") + _group("0", "99999999")
    out = decode_leet(far)
    assert out.unmatched == 3
    assert out.text == "\ufffd" + " " * 256 + "\ufffd" + "\n" * 32 + "\ufffd"
    with pytest.raises(DeqError, match="more than 256 glyphs"):
        decode_leet(head + _group("0", "0") * 257)
    assert decode_leet(head + _group("1.2.3", "0")).unmatched == 0


def test_scene_svg_and_options() -> None:
    cell = Cell(0, 0, ({"shape": "dot", "params": {}, "transform": {"rotate": 90}},))
    svg = scene_svg(Scene(24, 24, (cell,)), {"colors": ["red"]}, "t")
    assert 'color="red" stroke="currentColor"' in svg
    assert resolve_scene_options().colors == ()
    many = Scene(24, 24, tuple(Cell(0, 0, ({"shape": "roj-sun-circle"},)) for _ in range(20001)))
    with pytest.raises(DeqError, match="more than 20000 elements"):
        scene_svg(many)


def test_pattern_results() -> None:
    r = pattern({"kind": "grid", "motifs": ["dot"], "cols": 2, "rows": 1})
    assert r.motifs == ("dot", "dot")
    assert len(r.scene.cells) == 2
    assert pattern().svg.startswith("<svg")


@pytest.mark.parametrize(
    ("options", "message"),
    [
        ({"kind": "spiral"}, "kind: must be one of band, grid, rosette, border"),
        ({"count": 4}, "count: must be odd"),
        ({"count": 65}, "count: must be from 3 to 63"),
        ({"count": "9"}, "count: must be an integer"),
        ({"motifs": []}, "motifs: must be a list of 1 to 64 shape ids"),
        ({"motifs": ["Bad Id"]}, "motifs: must be a list of 1 to 64 shape ids"),
        ({"kind": "border", "cols": 2}, "a border needs at least 3 x 3 cells"),
    ],
)
def test_pattern_bad_options(options: dict[str, Any], message: str) -> None:
    with pytest.raises(DeqError, match=message):
        pattern(options)


def test_pattern_unknown_motif() -> None:
    with pytest.raises(DeqError) as err:
        pattern({"motifs": ["no-such-shape"]})
    assert err.value.code == "UNKNOWN_SHAPE"
