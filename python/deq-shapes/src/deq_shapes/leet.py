"""Deq Leet: text written with Deq glyphs, and decoding of ``basic`` output (ADR 0015).

The tables come from ``data/leet.json``, generated from ``spec/leet/``.
"""

import re
import unicodedata
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from functools import cache
from typing import Any, Final, Literal

from ._data import load
from ._format import is_integer, js_round, num
from .errors import DeqError
from .options import _number, _picklist
from .rng import MAX_SEED, Random
from .scene import Cell, Glyph, Scene, glyph_markup, resolve_scene_options, scene_svg

Script = Literal["latin", "sorani"]
LeetLevel = Literal["basic", "advanced", "full"]

#: The longest input accepted, in UTF-16 code units.
MAX_INPUT: Final = 1024
#: The most glyphs one text may draw.
MAX_GLYPHS: Final = 256
#: The most lines one text may have.
MAX_LINES: Final = 32
#: Largest SVG :func:`decode_leet` reads, in UTF-16 code units.
MAX_DECODE_INPUT: Final = 4 * 1024 * 1024

# Joiners, tatweel and bidi controls carry no letter of their own.
_IGNORED: Final = re.compile("[\u200b-\u200f\u202a-\u202e\u2066-\u2069\u0640\ufeff]")
_SPACE: Final = re.compile("[\t \u00a0\u2000-\u200a\u202f\u205f\u3000]")
_ARABIC: Final = re.compile("[\u0600-\u06ff]")
# What JavaScript's trimStart removes.
_JS_SPACE: Final = (
    " \t\n\v\f\r\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009"
    "\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
)
_NUM: Final = r"[0-9]+(?:\.[0-9]+)?"
_META: Final = re.compile(
    rf'<svg [^>]*?data-deq-leet="(latin|sorani) (basic|advanced|full) ({_NUM}) ({_NUM})"'
)
_GROUP: Final = re.compile(
    rf'<g data-layer="c[0-9]+" transform="translate\((-?{_NUM}) (-?{_NUM})\)"'
    rf'(?: color="[^"<>]*" stroke="currentColor")?>(.*?)</g>',
    re.DOTALL,
)


def _utf16_len(s: str) -> int:
    return len(s.encode("utf-16-le")) // 2


@dataclass(frozen=True, slots=True)
class LeetEntry:
    """One character of a table with its glyph at each level."""

    char: str
    #: ``good``, ``fair``, ``rough``, or ``count`` for dot-count digits.
    fit: str
    basic: Glyph
    #: Alternatives for the advanced level; empty means the basic glyph.
    advanced: tuple[Glyph, ...]
    full: Glyph


@dataclass(frozen=True, slots=True)
class LeetTable:
    """The mapping table of one script."""

    version: int
    script: Script
    direction: Literal["ltr", "rtl"]
    aliases: Mapping[str, str]
    glyphs: tuple[LeetEntry, ...]


@cache
def leet_table(script: Script) -> LeetTable:
    """The table of ``script``."""
    data = load("leet.json")[script]
    return LeetTable(
        version=data["version"],
        script=data["script"],
        direction=data["direction"],
        aliases=dict(data["aliases"]),
        glyphs=tuple(
            LeetEntry(
                char=e["char"],
                fit=e["fit"],
                basic=e["basic"],
                advanced=tuple(e["advanced"]),
                full=e["full"],
            )
            for e in data["glyphs"]
        ),
    )


@cache
def _index(script: Script) -> dict[str, LeetEntry]:
    return {e.char: e for e in leet_table(script).glyphs}


def entry_of(script: Script, char: str) -> LeetEntry | None:
    """The entry for an already normalised character, if the table has one."""
    return _index(script).get(char)


def detect_script(text: str) -> Script:
    """Sorani when ``text`` has Arabic-script letters, else Latin."""
    return "sorani" if _ARABIC.search(text) else "latin"


@dataclass(frozen=True, slots=True)
class Normalized:
    """The result of :func:`normalize`."""

    #: Lines of tokens (a :class:`LeetEntry`, or ``None`` for a space), trimmed.
    lines: tuple[tuple[LeetEntry | None, ...], ...]
    #: The normalised text (what decoding ``basic`` output gives back).
    text: str
    #: Characters with no glyph in the table, in first-seen order.
    unknown: tuple[str, ...]


def normalize(text: str, script: Script) -> Normalized:
    """Normalise ``text`` for ``script``: NFC, LF, no joiners or tatweel, upper case, aliases.

    :raises DeqError: ``LIMIT_EXCEEDED`` for input over :data:`MAX_INPUT`, more than
        :data:`MAX_GLYPHS` glyphs or more than :data:`MAX_LINES` lines.
    """
    if _utf16_len(text) > MAX_INPUT:
        raise DeqError("LIMIT_EXCEEDED", f"text is longer than {MAX_INPUT} characters")
    aliases = leet_table(script).aliases
    index = _index(script)
    unknown: list[str] = []
    line: list[LeetEntry | None] = []
    raw = [line]
    glyphs = 0
    clean = unicodedata.normalize("NFC", text).replace("\r\n", "\n").replace("\r", "\n")
    for ch in _IGNORED.sub("", clean):
        if ch == "\n":
            line = []
            raw.append(line)
            continue
        if _SPACE.fullmatch(ch):
            line.append(None)
            continue
        for up in ch.upper():
            entry = index.get(aliases.get(up, up))
            if entry is not None:
                line.append(entry)
                glyphs += 1
            elif ch not in unknown:
                unknown.append(ch)
    if glyphs > MAX_GLYPHS:
        raise DeqError("LIMIT_EXCEEDED", f"text has more than {MAX_GLYPHS} glyphs")
    trimmed = []
    for row in raw:
        a, b = 0, len(row)
        while a < b and row[a] is None:
            a += 1
        while b > a and row[b - 1] is None:
            b -= 1
        trimmed.append(tuple(row[a:b]))
    while trimmed and not trimmed[0]:
        trimmed.pop(0)
    while trimmed and not trimmed[-1]:
        trimmed.pop()
    if len(trimmed) > MAX_LINES:
        raise DeqError("LIMIT_EXCEEDED", f"text has more than {MAX_LINES} lines")
    out = "\n".join("".join(" " if t is None else t.char for t in row) for row in trimmed)
    return Normalized(tuple(trimmed), out, tuple(unknown))


def _integer(lo: int, hi: int) -> Callable[[Any], str | None]:
    def check(v: Any) -> str | None:
        if not is_integer(v):
            return "must be an integer"
        return None if lo <= v <= hi else f"must be from {lo} to {hi} (got {v})"

    return check


_LEET_CHECKS: Final[tuple[tuple[str, Callable[[Any], str | None]], ...]] = (
    ("level", _picklist("basic", "advanced", "full")),
    ("script", _picklist("latin", "sorani")),
    ("seed", _integer(0, MAX_SEED)),
    ("letterSpacing", _number(0, 24)),
    ("lineSpacing", _number(0, 48)),
    ("align", _picklist("start", "center", "end")),
)


def split_options(
    options: Mapping[str, Any] | None,
    checks: Sequence[tuple[str, Callable[[Any], str | None]]],
    what: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Split ``options`` into checked own options and the scene options left over."""
    own: dict[str, Any] = {}
    scene = dict(options or {})
    issues: list[str] = []
    for key, check in checks:
        if key in scene:
            value = scene.pop(key)
            problem = check(value)
            if problem is None:
                own[key] = value
            else:
                issues.append(f"{key}: {problem}")
    if issues:
        raise DeqError("INVALID_OPTIONS", f"invalid {what}: {'; '.join(issues)}", tuple(issues))
    return own, scene


@dataclass(frozen=True, slots=True)
class LeetResult:
    """The result of :func:`leet`."""

    #: The SVG document, one ``<g data-layer="cN">`` per glyph in reading order.
    svg: str
    #: The normalised text that was drawn.
    text: str
    script: Script
    level: LeetLevel
    #: Input characters with no glyph, in first-seen order (they are left out).
    unknown: tuple[str, ...]
    scene: Scene


def _glyph_for(entry: LeetEntry, level: str, random: Random) -> Glyph:
    if level == "basic":
        return entry.basic
    if level == "full":
        return entry.full
    return random.pick([entry.basic, *entry.advanced])


def leet(text: str, options: Mapping[str, Any] | None = None) -> LeetResult:
    """Write ``text`` with Deq glyphs.

    The input is plain text: length-capped, normalised and never parsed as markup.
    Characters without a glyph are left out and listed in ``unknown``; Sorani runs right to
    left. Options are ``level``, ``script``, ``seed``, ``letterSpacing``, ``lineSpacing``,
    ``align``, ``colors`` and the render options except the per-shape ones.

    :raises DeqError: ``INVALID_OPTIONS`` (also when nothing is left to draw) or
        ``LIMIT_EXCEEDED``.
    """
    if not isinstance(text, str):
        raise DeqError("INVALID_OPTIONS", "text must be a string", ("text: must be a string",))
    own, scene = split_options(options, _LEET_CHECKS, "leet options")
    resolve_scene_options(scene)
    lvl: LeetLevel = own.get("level", "basic")
    sc: Script = own.get("script") or detect_script(text)
    rtl = leet_table(sc).direction == "rtl"
    norm = normalize(text, sc)
    if not any(norm.lines):
        issue = f"text: no characters of the {sc} table"
        raise DeqError("INVALID_OPTIONS", f"invalid text: {issue}", (issue,))
    ls = own.get("letterSpacing", 2)
    lh = own.get("lineSpacing", 6)
    ax = 24 + ls
    ay = 24 + lh
    cols = max(len(row) for row in norm.lines)
    width = cols * ax - ls
    height = len(norm.lines) * ay - lh
    random = Random(own.get("seed", 1))
    at = own.get("align", "start")
    cells: list[Cell] = []
    for row, tokens in enumerate(norm.lines):
        free = width - (len(tokens) * ax - ls)
        # The offset of the line's leftmost cell.
        left = free / 2 if at == "center" else (free if (at == "end") != rtl else 0)
        for col, token in enumerate(tokens):
            if token is None:
                continue
            x = left + ((len(tokens) - 1 - col) if rtl else col) * ax
            cells.append(Cell(x, row * ay, _glyph_for(token, lvl, random)))
    placed = Scene(width, height, tuple(cells))
    meta = f' data-deq-leet="{sc} {lvl} {num(ax)} {num(ay)}"'
    svg = scene_svg(placed, scene, norm.text.replace("\n", " "), meta)
    return LeetResult(svg, norm.text, sc, lvl, norm.unknown, placed)


@dataclass(frozen=True, slots=True)
class DecodedLeet:
    """The result of :func:`decode_leet`."""

    #: The text; glyphs that are not basic glyphs read as U+FFFD.
    text: str
    script: Script
    #: How many glyph groups were not basic glyphs of the table.
    unmatched: int


def decode_leet(svg: str, options: Mapping[str, Any] | None = None) -> DecodedLeet:
    """Read the text back from Leet SVG written by :func:`leet` at the ``basic`` level.

    ``options`` must be the render options used to write it. The SVG is treated as text and
    only matched against what :func:`leet` writes.

    :raises DeqError: ``INVALID_OPTIONS`` when the input is not Deq Leet SVG, or
        ``LIMIT_EXCEEDED`` (input over :data:`MAX_DECODE_INPUT`, more than
        :data:`MAX_GLYPHS` glyphs).
    """
    if not isinstance(svg, str) or _utf16_len(svg) > MAX_DECODE_INPUT:
        msg = f"SVG is larger than {MAX_DECODE_INPUT} characters"
        raise DeqError("LIMIT_EXCEEDED", msg)
    meta = _META.match(svg.lstrip(_JS_SPACE))
    if meta is None:
        issue = "svg: not Deq Leet SVG (no data-deq-leet attribute)"
        raise DeqError("INVALID_OPTIONS", f"invalid input: {issue}", (issue,))
    script: Script = "sorani" if meta[1] == "sorani" else "latin"
    ax = float(meta[3])
    ay = float(meta[4])
    # The advances leet() can write: 24 plus the letter (0..24) or line (0..48) spacing.
    if ax < 24 or ax > 48 or ay < 24 or ay > 72:
        issue = "svg: data-deq-leet advances out of range"
        raise DeqError("INVALID_OPTIONS", f"invalid input: {issue}", (issue,))
    o = resolve_scene_options(options).render
    by_markup: dict[str, str] = {}
    for entry in leet_table(script).glyphs:
        by_markup[glyph_markup(entry.basic, o)] = entry.char
    parts: list[str] = []
    unmatched = 0
    prev: tuple[float, float] | None = None
    for glyphs, m in enumerate(_GROUP.finditer(svg), 1):
        if glyphs > MAX_GLYPHS:
            raise DeqError("LIMIT_EXCEEDED", f"SVG has more than {MAX_GLYPHS} glyphs")
        x, y = float(m[1]), float(m[2])
        if prev is not None:
            # Gaps are capped at what leet() can write, so crafted offsets cannot blow up.
            rows = min(js_round((y - prev[1]) / ay), MAX_LINES)
            gap = js_round(abs(x - prev[0]) / ax) - 1
            parts.append("\n" * rows if rows > 0 else " " * min(max(0, gap), MAX_GLYPHS))
        prev = (x, y)
        char = by_markup.get(m[3])
        if char is None:
            unmatched += 1
        parts.append("\ufffd" if char is None else char)
    return DecodedLeet("".join(parts), script, unmatched)
