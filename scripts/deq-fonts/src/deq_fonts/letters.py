"""A small monoline alphabet (a-z, 0-9 and the hyphen) drawn with the same strokes as the
icons, so the ligature names (``roj-half-sun``) stay readable before they turn into icons.

Canvas units: lowercase letters sit on y = 19 with the x-height at y = 11; ascenders reach
y = 5, descenders y = 23 and figures y = 6.
"""

from __future__ import annotations

import math
from typing import Any

Item = dict[str, Any]


def line(x1: float, y1: float, x2: float, y2: float) -> Item:
    return {"kind": "poly", "points": [[x1, y1], [x2, y2]], "closed": False}


def poly(*points: tuple[float, float], closed: bool = False) -> Item:
    return {"kind": "poly", "points": [list(p) for p in points], "closed": closed}


def arc(cx: float, cy: float, r: float, start: float, end: float) -> Item:
    return {"kind": "arc", "cx": cx, "cy": cy, "r": r, "start": start, "end": end}


def ring(cx: float, cy: float, r: float) -> Item:
    return {"kind": "circle", "cx": cx, "cy": cy, "r": r}


def point(x: float, y: float) -> Item:
    """A round dot that grows with the stroke weight (a zero-length line)."""
    return line(x, y, x, y)


def _on(cx: float, cy: float, r: float, deg: float) -> tuple[float, float]:
    rad = math.radians(deg)
    return cx + r * math.cos(rad), cy + r * math.sin(rad)


#: Advance width in canvas units and the strokes of each glyph.
LETTERS: dict[str, tuple[float, list[Item]]] = {
    "a": (14, [ring(7, 15, 4), line(11, 11, 11, 19)]),
    "b": (14, [line(3, 5, 3, 19), ring(7, 15, 4)]),
    "c": (14, [arc(7, 15, 4, 45, 315)]),
    "d": (14, [ring(7, 15, 4), line(11, 5, 11, 19)]),
    "e": (14, [line(3, 15, 11, 15), arc(7, 15, 4, 45, 360)]),
    "f": (12, [line(6, 19, 6, 9), arc(10, 9, 4, 180, 270), line(3, 11, 9, 11)]),
    "g": (14, [ring(7, 15, 4), line(11, 11, 11, 20), arc(8, 20, 3, 0, 180)]),
    "h": (14, [line(3, 5, 3, 19), arc(7, 15, 4, 180, 360), line(11, 15, 11, 19)]),
    "i": (8, [line(4, 11, 4, 19), point(4, 7)]),
    "j": (10, [line(7, 11, 7, 20), arc(4, 20, 3, 0, 180), point(7, 7)]),
    "k": (13, [line(3, 5, 3, 19), line(10, 11, 3, 16), line(6, 14, 10, 19)]),
    "l": (8, [line(4, 5, 4, 19)]),
    "m": (
        18,
        [
            line(3, 11, 3, 19),
            arc(6, 14, 3, 180, 360),
            line(9, 14, 9, 19),
            arc(12, 14, 3, 180, 360),
            line(15, 14, 15, 19),
        ],
    ),
    "n": (14, [line(3, 11, 3, 19), arc(7, 15, 4, 180, 360), line(11, 15, 11, 19)]),
    "o": (14, [ring(7, 15, 4)]),
    "p": (14, [line(3, 11, 3, 23), ring(7, 15, 4)]),
    "q": (14, [line(11, 11, 11, 23), ring(7, 15, 4)]),
    "r": (11, [line(3, 11, 3, 19), arc(7, 15, 4, 180, 300)]),
    "s": (12, [arc(6, 13, 2, 90, 330), arc(6, 17, 2, 270, 360), arc(6, 17, 2, 0, 150)]),
    "t": (11, [line(5, 6, 5, 17), arc(7, 17, 2, 90, 180), line(2, 11, 8, 11)]),
    "u": (14, [line(3, 11, 3, 15), arc(7, 15, 4, 0, 180), line(11, 11, 11, 19)]),
    "v": (14, [poly((3, 11), (7, 19), (11, 11))]),
    "w": (16, [poly((2, 11), (5, 19), (8, 13), (11, 19), (14, 11))]),
    "x": (14, [line(3, 11, 11, 19), line(11, 11, 3, 19)]),
    "y": (14, [line(3, 11, 7, 19), line(11, 11, 5, 23)]),
    "z": (14, [poly((3, 11), (11, 11), (3, 19), (11, 19))]),
    "zero": (
        14,
        [
            arc(7, 10, 4, 180, 360),
            arc(7, 15, 4, 0, 180),
            line(3, 10, 3, 15),
            line(11, 10, 11, 15),
        ],
    ),
    "one": (14, [poly((4, 8), (7, 6), (7, 19)), line(4, 19, 10, 19)]),
    "two": (
        14,
        [
            arc(7, 10, 4, 180, 360),
            arc(7, 10, 4, 0, 30),
            poly(_on(7, 10, 4, 30), (3, 19), (11, 19)),
        ],
    ),
    "three": (
        14,
        [
            arc(7, 9.5, 3.5, 180, 360),
            arc(7, 9.5, 3.5, 0, 90),
            arc(7, 16, 3, 270, 360),
            arc(7, 16, 3, 0, 160),
        ],
    ),
    "four": (14, [poly((9, 19), (9, 6), (3, 15), (12, 15))]),
    "five": (
        14,
        [
            poly((11, 6), (4.5, 6), _on(7, 15, 4, 225)),
            arc(7, 15, 4, 225, 360),
            arc(7, 15, 4, 0, 150),
        ],
    ),
    "six": (14, [ring(7, 15, 4), arc(11, 15, 8, 180, 240)]),
    "seven": (14, [poly((3, 6), (11, 6), (6, 19))]),
    "eight": (14, [ring(7, 9.5, 3.5), ring(7, 16, 3)]),
    "nine": (14, [ring(7, 10, 4), arc(3, 10, 8, 0, 60)]),
    "hyphen": (12, [line(3, 15, 9, 15)]),
}

#: The character each glyph maps to.
CHARACTERS: dict[str, str] = {
    **{c: c for c in "abcdefghijklmnopqrstuvwxyz"},
    "zero": "0",
    "one": "1",
    "two": "2",
    "three": "3",
    "four": "4",
    "five": "5",
    "six": "6",
    "seven": "7",
    "eight": "8",
    "nine": "9",
    "hyphen": "-",
}

#: The .notdef box.
NOTDEF: tuple[float, list[Item]] = (14, [poly((3, 5), (11, 5), (11, 19), (3, 19), closed=True)])
