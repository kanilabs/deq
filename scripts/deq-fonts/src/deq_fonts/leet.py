"""Build the Deq Leet font (ADR 0016): normal text in this font shows Deq Leet glyphs.

* ``DeqLeet-Regular.{otf,ttf,woff2}``: static, stroke width 2, one glyph per table character
  and level. The geometry comes from the generator's ``expandGlyph`` through
  ``pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json``.
* The character map sends each table character (and its lower case and aliases) straight to
  its basic glyph, so the font works without shaping; shapers compose decomposed input
  (``C`` + U+0327) to the precomposed glyph. GSUB adds the rest: ``locl`` picks the Sorani
  glyph of characters both tables share in Arabic-script runs, ``ss01`` and ``ss02`` pick the
  advanced alternatives, ``ss03`` the full level, and ``salt`` offers all of them.
* Every cell is 26 units wide, so the font is monospaced.
* Every glyph also has a Private Use Area code point from U+F000 (``fonts/leet-codepoints.json``,
  never changed or reused), so text copied from a Leet scene keeps the exact glyphs.
"""

from __future__ import annotations

import json
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.otlLib.maxContextCalc import maxCtxFont
from fontTools.ttLib import TTFont

from deq_fonts.build import Glyph, finish_tables, font
from deq_fonts.letters import NOTDEF
from deq_fonts.outline import SCALE

FAMILY = "Deq Leet"
DESCRIPTION = "Text written as traditional Kurdish tattoo (deq) motifs: Deq Leet."
FIRST = 0xF000
LAST = 0xF8FF
#: One cell is 24 canvas units plus the default letter spacing (2), the glyph centred in it.
ADVANCE = 26.0
OFFSET = 1.0
#: The default line spacing (6 canvas units), split above and below the line.
LEADING = round(6 * SCALE)
#: Stylistic sets: ss01 and ss02 for the advanced alternatives, ss03 for the full level.
SET_NAMES = {
    "ss01": "Advanced alternative 1",
    "ss02": "Advanced alternative 2",
    "ss03": "Full level",
}

Items = list[Mapping[str, Any]]
#: ``{script: {char: {"basic": "F000", "advanced": ["F001"], "full": "F002"}}}``.
LeetCodepoints = dict[str, dict[str, dict[str, Any]]]


@dataclass(frozen=True)
class LeetGlyph:
    char: str
    basic: Items
    advanced: tuple[Items, ...]
    full: Items


@dataclass(frozen=True)
class LeetScript:
    name: str
    direction: str
    aliases: dict[str, str]
    glyphs: tuple[LeetGlyph, ...]


def load_leet(path: Path) -> list[LeetScript]:
    """The scripts from the generator's ``font-data`` output."""
    if not path.exists():
        raise SystemExit(
            f"{path} not found: run `pnpm --filter @0xdolan/deq-generator font-data {path}`"
        )
    data = json.loads(path.read_text(encoding="utf-8"))["scripts"]
    return [
        LeetScript(
            name=name,
            direction=s["direction"],
            aliases=dict(s["aliases"]),
            glyphs=tuple(
                LeetGlyph(
                    char=g["char"],
                    basic=list(g["basic"]),
                    advanced=tuple(list(a) for a in g["advanced"]),
                    full=list(g["full"]),
                )
                for g in s["glyphs"]
            ),
        )
        for name, s in data.items()
    ]


def _values(cps: LeetCodepoints) -> Iterator[str]:
    for chars in cps.values():
        for entry in chars.values():
            yield from (v for k in ("basic", "full") if (v := entry.get(k)) is not None)
            yield from entry.get("advanced", [])


def assign_leet(scripts: Sequence[LeetScript], current: LeetCodepoints) -> LeetCodepoints:
    """Keep every existing code point (also for removed characters, so none is reused) and give
    new glyphs the next free ones, in table order: basic, advanced, full."""
    out: LeetCodepoints = json.loads(json.dumps(current))
    used = [int(v, 16) for v in _values(out)]
    if len(set(used)) != len(used) or any(not FIRST <= c <= LAST for c in used):
        raise ValueError("Leet code points must be unique and in U+F000-U+F8FF")
    nxt = max(used, default=FIRST - 1) + 1

    def take() -> str:
        nonlocal nxt
        if nxt > LAST:
            raise ValueError("the Leet Private Use Area block is full")
        nxt += 1
        return f"{nxt - 1:04X}"

    for script in scripts:
        chars = out.setdefault(script.name, {})
        for g in script.glyphs:
            entry = chars.setdefault(g.char, {})
            if "basic" not in entry:
                entry["basic"] = take()
            alts = entry.setdefault("advanced", [])
            while len(alts) < len(g.advanced):
                alts.append(take())
            if "full" not in entry:
                entry["full"] = take()
    return out


def load_leet_codepoints(path: Path) -> LeetCodepoints:
    if not path.exists():
        return {}
    data: LeetCodepoints = json.loads(path.read_text(encoding="utf-8"))["codepoints"]
    return data


def leet_codepoints_json(cps: LeetCodepoints) -> str:
    body = {
        "description": "Private Use Area code points of the Deq Leet font, per script and "
        "character: the basic glyph, the advanced alternatives in table order, and the full "
        "glyph. Generated by `uv run deq-fonts codepoints`; never change or reuse a value.",
        "codepoints": cps,
    }
    return json.dumps(body, indent=2, ensure_ascii=False) + "\n"


def _cell(char: str) -> str:
    return f"`{char}`" if char.strip() else f"U+{ord(char):04X}"


def leet_table(scripts: Sequence[LeetScript], cps: LeetCodepoints) -> str:
    """``docs/fonts/leet-codepoints.md``."""
    lines = [
        "<!-- Generated by `uv run deq-fonts codepoints`; do not edit. -->",
        "",
        "# Deq Leet code points",
        "",
        "Private Use Area code points of the Deq Leet font (ADR 0016). Typing normal text in",
        "the font shows the basic glyphs; these code points select one glyph exactly. The",
        "advanced level picks the basic glyph or one of its alternatives.",
        "",
    ]
    for script in scripts:
        lines += [
            f"## {script.name.capitalize()}",
            "",
            "| Character | Basic | Advanced | Full |",
            "| --------- | ----- | -------- | ---- |",
        ]
        for g in script.glyphs:
            e = cps[script.name][g.char]
            alts = ", ".join(f"U+{v}" for v in e["advanced"][: len(g.advanced)]) or "none"
            lines.append(f"| {_cell(g.char)} | U+{e['basic']} | {alts} | U+{e['full']} |")
        lines.append("")
    return "\n".join(lines)


@dataclass
class LeetPlan:
    glyphs: list[Glyph]
    cmap: dict[int, str]
    fea: str


def _base_name(script: str, char: str, shared: set[str]) -> str:
    name = f"uni{ord(char):04X}"
    return f"{name}.ar" if script == "sorani" and char in shared else name


def plan(scripts: Sequence[LeetScript], cps: LeetCodepoints) -> LeetPlan:
    """The glyphs, the character map and the feature code of the Leet font."""
    by_name = {s.name: s for s in scripts}
    latin, sorani = by_name["latin"], by_name["sorani"]
    shared = {g.char for g in latin.glyphs} & {g.char for g in sorani.glyphs}
    glyphs = [
        Glyph(".notdef", ADVANCE, NOTDEF[1], offset=(ADVANCE - NOTDEF[0]) / 2),
        Glyph("space", ADVANCE, []),
        Glyph("uni00A0", ADVANCE, []),
    ]
    cmap: dict[int, str] = {0x20: "space", 0xA0: "uni00A0"}
    pua: dict[int, str] = {}
    sets: dict[str, list[tuple[str, str]]] = {k: [] for k in SET_NAMES}
    salt: list[tuple[str, list[str]]] = []
    base: dict[tuple[str, str], str] = {}
    for script in (latin, sorani):
        for g in script.glyphs:
            entry = cps[script.name][g.char]
            name = _base_name(script.name, g.char, shared)
            base[(script.name, g.char)] = name
            alt_names = [f"{name}.alt{i + 1}" for i in range(len(g.advanced))]
            full = f"{name}.full"
            glyphs.append(Glyph(name, ADVANCE, g.basic, offset=OFFSET))
            glyphs += [
                Glyph(n, ADVANCE, items, offset=OFFSET)
                for n, items in zip(alt_names, g.advanced, strict=True)
            ]
            glyphs.append(Glyph(full, ADVANCE, g.full, offset=OFFSET))
            pua[int(entry["basic"], 16)] = name
            pua |= {int(v, 16): n for v, n in zip(entry["advanced"], alt_names, strict=False)}
            pua[int(entry["full"], 16)] = full
            for i, n in enumerate(alt_names[:2]):
                sets[f"ss0{i + 1}"].append((name, n))
            sets["ss03"].append((name, full))
            salt.append((name, [*alt_names, full]))
            if name.endswith(".ar"):
                continue
            for c in {g.char, g.char.lower()}:
                if len(c) == 1:
                    cmap.setdefault(ord(c), name)
    # Aliases: a free code point maps straight to the glyph; a taken one (ASCII digits in
    # Sorani) and every shared character switch to the Sorani glyph in Arabic-script runs.
    sorani_forms = {cmap[ord(c)]: base[("sorani", c)] for c in sorted(shared)}
    for script in (latin, sorani):
        for alias, target in sorted(script.aliases.items()):
            glyph = base[(script.name, target)]
            if ord(alias) not in cmap:
                # A shared target maps to the Latin glyph, which `locl` switches.
                cmap[ord(alias)] = cmap[ord(target)] if glyph.endswith(".ar") else glyph
            elif script.name == "sorani" and cmap[ord(alias)] != glyph:
                sorani_forms.setdefault(cmap[ord(alias)], glyph)
    cmap |= pua
    return LeetPlan(glyphs, cmap, _features(sorani_forms, sets, salt))


def _features(
    sorani_forms: Mapping[str, str],
    sets: Mapping[str, Sequence[tuple[str, str]]],
    salt: Sequence[tuple[str, Sequence[str]]],
) -> str:
    """The GSUB feature code."""
    out = [
        "languagesystem DFLT dflt;",
        "languagesystem latn dflt;",
        "languagesystem arab dflt;",
        "",
    ]
    if sorani_forms:
        rules = "\n".join(f"    sub {k} by {v};" for k, v in sorted(sorani_forms.items()))
        out += ["feature locl {", "    script arab;", rules, "} locl;", ""]
    for tag, label in SET_NAMES.items():
        rules = "\n".join(f"    sub {k} by {v};" for k, v in sets[tag])
        if rules:
            out += [f"feature {tag} {{", f'    featureNames {{ name "{label}"; }};', rules]
            out += [f"}} {tag};", ""]
    rules = "\n".join(f"    sub {k} from [{' '.join(v)}];" for k, v in salt if v)
    out += ["feature salt {", rules, "} salt;", ""]
    return "\n".join(out)


def leet_fonts(
    scripts: Sequence[LeetScript], cps: LeetCodepoints, version: str
) -> dict[str, TTFont]:
    """``DeqLeet-Regular.otf`` and ``.ttf``."""
    p = plan(scripts, cps)
    out = {}
    for ext, cff in (("otf", True), ("ttf", False)):
        tt = font(
            p.glyphs,
            family=FAMILY,
            version=version,
            cff=cff,
            cmap=p.cmap,
            leading=LEADING,
            description=DESCRIPTION,
        )
        addOpenTypeFeaturesFromString(tt, p.fea)
        tt["post"].isFixedPitch = 1
        tt["OS/2"].panose.bFamilyType = 2  # Latin text
        tt["OS/2"].panose.bProportion = 9  # monospaced
        tt["OS/2"].usMaxContext = maxCtxFont(tt)
        finish_tables(tt)
        out[f"DeqLeet-Regular.{ext}"] = tt
    return out


def leet_css() -> str:
    """``deq-leet.css``: the font face and the ``.deq-leet`` class."""
    return "\n".join(
        [
            "/* Deq Leet font. Generated by `uv run deq-fonts build`; do not edit. */",
            "@font-face {",
            f'  font-family: "{FAMILY}";',
            '  src: url("DeqLeet-Regular.woff2") format("woff2");',
            "  font-weight: 400;",
            "  font-style: normal;",
            "  font-display: block;",
            "}",
            ".deq-leet {",
            f'  font-family: "{FAMILY}";',
            "  font-size: 24px;",
            "  line-height: normal;",
            "}",
            "",
        ]
    )
