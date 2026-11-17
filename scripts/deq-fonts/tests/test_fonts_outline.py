from __future__ import annotations

import math
from typing import Any

import pytest
from fontTools.pens.recordingPen import RecordingPen

from deq_fonts.letters import CHARACTERS, LETTERS, NOTDEF
from deq_fonts.outline import (
    MIN_INNER,
    SCALE,
    Node,
    Outline,
    _flatten,
    arc_nodes,
    area,
    band,
    capsule,
    circle,
    draw,
    outline,
    to_font,
)


def test_arc_nodes_split_into_45_degree_segments() -> None:
    nodes = arc_nodes(0, 0, 2, 0, 90)
    assert len(nodes) == 4
    assert [n.on for n in nodes] == [False, True, False, True]
    end = nodes[-1]
    assert end.x == pytest.approx(0, abs=1e-9)
    assert end.y == pytest.approx(2)
    # Segment count depends on the sweep only, so weights interpolate.
    assert len(arc_nodes(0, 0, 9, 0, 90)) == len(nodes)
    assert len(arc_nodes(0, 0, 1, 0, 10)) == 2


def test_circle_and_capsule_are_closed_quadratic_contours() -> None:
    c = circle(1, 1, 1)
    assert c[0] == Node(2, 1)
    assert len(c) == 16
    cap = capsule((0, 0), (4, 0), 1)
    assert cap[0].x == pytest.approx(0)
    assert cap[0].y == pytest.approx(1)
    assert len(cap) == 2 + 8 + 1 + 7
    # A zero-length segment is a round dot.
    dot = capsule((3, 3), (3, 3), 0.5)
    xs = [n.x for n in dot if n.on]
    assert max(xs) == pytest.approx(3.5)
    assert min(xs) == pytest.approx(2.5)


def test_band_clamps_the_inner_radius() -> None:
    contour = band(0, 0, 1, 0, 180, 2)
    radii = [math.hypot(n.x, n.y) for n in contour if n.on]
    assert min(radii) == pytest.approx(MIN_INNER)


def test_flatten_paths() -> None:
    lines = _flatten(
        [["M", [0, 0]], ["L", [1, 0]], ["Q", [2, 0], [2, 1]], ["C", [2, 2], [1, 3], [0, 3]], ["Z"]]
    )
    assert len(lines) == 1
    assert len(lines[0]) == 2 + 8 + 12 + 1
    assert lines[0][-1] == (0.0, 0.0)
    assert lines[0][9] == pytest.approx((2.0, 1.0))
    with pytest.raises(ValueError, match="unsupported path command: A"):
        _flatten([["M", [0, 0]], ["A", [1, 1]]])


def test_outline_kinds() -> None:
    items: list[dict[str, Any]] = [
        {"kind": "poly", "points": [[0, 0], [4, 0], [4, 4]], "closed": True},
        {"kind": "poly", "points": [[0, 0], [1, 1], [0, 1]], "closed": True, "paint": "fill"},
        {"kind": "poly", "points": [[5, 5]], "closed": False},
        {"kind": "circle", "cx": 5, "cy": 5, "r": 3},
        {"kind": "circle", "cx": 5, "cy": 5, "r": 1, "paint": "fill"},
        {"kind": "circle", "cx": 5, "cy": 5, "r": 1, "dot": True},
        {"kind": "arc", "cx": 5, "cy": 5, "r": 3, "start": 0, "end": 90},
        {"kind": "path", "segments": [["M", [0, 0]], ["L", [2, 0]], ["L", [2, 2]]]},
    ]
    out = outline(items, 2, dot_scale=2)
    # 3 closed-poly capsules, 1 fill, 1 dot capsule, ring, fill circle, dot, band, 2 path capsules.
    assert len(out.solid) == 3 + 1 + 1 + 1 + 1 + 1 + 1 + 2
    assert len(out.holes) == 1
    dot = out.solid[7]
    assert max(n.x for n in dot) == pytest.approx(7)
    with pytest.raises(ValueError, match="unsupported item: path"):
        outline([{"kind": "path", "paint": "fill", "segments": []}], 2)
    with pytest.raises(ValueError, match="unsupported item: rect"):
        outline([{"kind": "rect"}], 2)


def test_to_font_winding_and_placement() -> None:
    square = [Node(0, 0), Node(0, 1), Node(1, 1), Node(1, 0)]  # clockwise in y-down
    counter = [square[0], *reversed(square[1:])]
    placed = to_font(Outline([square, counter], [square, counter]))
    assert [area(c) < 0 for c in placed] == [True, True, False, False]
    assert placed[0][0] == Node(0, 19 * SCALE)


def test_draw_emits_lines_and_curves() -> None:
    pen = RecordingPen()
    draw([[Node(0, 0), Node(1, 0), Node(2, 1, on=False), Node(2, 2)]], pen)
    ops = [op for op, _ in pen.value]
    assert ops == ["moveTo", "lineTo", "qCurveTo", "closePath"]  # closes to the start


def test_every_letter_has_a_character_and_an_outline() -> None:
    assert set(LETTERS) == set(CHARACTERS)
    assert len({*CHARACTERS.values()}) == len(CHARACTERS)
    for _, (advance, items) in [*LETTERS.items(), ("notdef", NOTDEF)]:
        assert advance > 0
        assert outline(items, 2).solid
