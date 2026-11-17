"""Small synthetic shapes that cover every item kind the outline builder supports."""

from __future__ import annotations

from typing import Any

from deq_fonts.build import Shape

SUN: dict[str, Any] = {
    "id": "roj-half-sun",
    "name": "Half sun",
    "kmr": "roj",
    "aliases": ["sun"],
    "category": "celestial",
    "flat": [
        {"kind": "arc", "cx": 12, "cy": 16.5, "r": 5, "start": 180, "end": 360, "layer": "arc"},
        {"kind": "poly", "points": [[4.5, 16.5], [2, 16.5]], "closed": False, "layer": "rays"},
        {
            "kind": "circle",
            "cx": 12,
            "cy": 16,
            "r": 1,
            "dot": True,
            "paint": "fill",
            "layer": "sun",
        },
    ],
}
RING: dict[str, Any] = {
    "id": "ring-dot",
    "name": "Ring",
    "kmr": "Roj",
    "aliases": ["sun", "bad alias!"],
    "category": "geometric",
    "flat": [
        {"kind": "circle", "cx": 12, "cy": 12, "r": 6},
        {"kind": "circle", "cx": 12, "cy": 12, "r": 2, "paint": "fill"},
        {"kind": "poly", "points": [[4, 4], [8, 4], [6, 8]], "closed": True, "paint": "fill"},
        {"kind": "poly", "points": [[20, 20]], "closed": False},
        {
            "kind": "path",
            "paint": "stroke",
            "segments": [
                ["M", [2, 2]],
                ["L", [4, 2]],
                ["Q", [6, 2], [6, 4]],
                ["C", [6, 6], [4, 8], [2, 8]],
                ["Z"],
            ],
        },
    ],
}


SHAPES = [Shape.load(SUN), Shape.load(RING)]
CODEPOINTS = {"roj-half-sun": "E000", "ring-dot": "E001"}
