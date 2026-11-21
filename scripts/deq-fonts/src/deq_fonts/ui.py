"""A Latin Extended-A subset of the site's UI font (Noto Sans, SIL OFL 1.1).

Fontsource ships Noto Sans latin-ext as one 168 KB variable file, which a page downloads for a
single character such as the dotless i (U+0131) in a Turkish place name. The subset keeps only
U+0100 to U+017F (every letter Kurdish and Turkish need beyond Latin-1, such as s-cedilla,
g-breve and both Turkish i) with the ``wght`` axis, about 15 KB. The site's
``src/styles/fonts.css`` declares it after the Fontsource faces, so browsers prefer it for that
range and fetch the full file only for rarer letters.
"""

from __future__ import annotations

import io
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FIRST, LAST = 0x0100, 0x017F


def latin_ext_a(source: Path) -> bytes:
    """The WOFF2 subset of ``source`` for U+0100 to U+017F, byte-for-byte reproducible."""
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    with TTFont(source, recalcTimestamp=False) as font:
        wanted = [c for c in font.getBestCmap() if FIRST <= c <= LAST]
        if not wanted:
            raise SystemExit(f"{source} has no characters in U+0100 to U+017F")
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=wanted)
        subsetter.subset(font)
        font.flavor = "woff2"
        out = io.BytesIO()
        font.save(out)
    return out.getvalue()
