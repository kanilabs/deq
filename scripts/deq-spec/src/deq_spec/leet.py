"""Lint for the Deq Leet tables in spec/leet/ (ADR 0015).

Each table maps the characters of one script to compositions of spec shapes. The rules:
the schema, script and direction, shape references and parameters, glyphs inside the
24 x 24 canvas, unique characters, aliases that point into the table, distinct basic
glyphs (so that `basic` output decodes back to the text), and canonical formatting.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import TYPE_CHECKING

from deq_spec import SpecError, jsonfmt, metrics
from deq_spec import geometry as g
from deq_spec.spec import Json, Registry, expand, read_json

if TYPE_CHECKING:
    from deq_spec.lint import Repo, Report

SCRIPTS = {"latin": "ltr", "sorani": "rtl"}
CANVAS = 24.0
EPS = 1e-6


def table_paths(repo: Repo) -> list[Path]:
    """The table files, one per script, in a stable order."""
    return [repo.spec / "leet" / f"{script}.json" for script in sorted(SCRIPTS)]


def lint_tables(repo: Repo, reg: Registry, report: Report) -> None:
    """Check every Leet table and add problems to ``report``."""
    validator = repo.schema("leet")
    spec_ids = {s for s, p in reg.paths.items() if p.parent == repo.shapes}
    known = table_paths(repo)
    for name in sorted(p.name for p in (repo.spec / "leet").glob("*") if p not in known):
        report.add(f"spec/leet/{name}", "unexpected file: tables are latin.json and sorani.json")
    for path in table_paths(repo):
        where = f"spec/leet/{path.name}"
        if not path.is_file():
            report.add(where, "missing")
            continue
        data = read_json(path)
        errs = [f"schema: {e.message}" for e in validator.iter_errors(data)]
        for e in errs:
            report.add(where, e)
        if errs:
            continue
        for e in _table_errors(data, path.stem, reg, spec_ids):
            report.add(where, e)
        if path.read_text(encoding="utf-8") != jsonfmt.dumps(data):
            report.add(where, "not canonically formatted: run `uv run deq-spec fmt`")


def _table_errors(data: Json, stem: str, reg: Registry, spec_ids: set[str]) -> Iterator[str]:
    if data["script"] != stem:
        yield f"script {data['script']!r} does not match the file name"
    if data["direction"] != SCRIPTS.get(data["script"]):
        yield f"direction of {data['script']} must be {SCRIPTS.get(data['script'])}"
    chars: set[str] = set()
    basics: dict[str, str] = {}
    for entry in data["glyphs"]:
        char = entry["char"]
        if char in chars:
            yield f"{char!r} is listed twice"
        chars.add(char)
        if char != char.upper():
            yield f"{char!r} must be upper case (input is case-folded first)"
        glyphs = [("basic", entry["basic"]), ("full", entry["full"])]
        glyphs += [(f"advanced[{i}]", glyph) for i, glyph in enumerate(entry["advanced"])]
        for level, glyph in glyphs:
            for e in _glyph_errors(glyph, reg, spec_ids):
                yield f"{char!r} {level}: {e}"
        key = json.dumps(entry["basic"], sort_keys=True)
        if key in basics:
            yield f"{char!r} basic glyph is the same as {basics[key]!r}; basic must decode"
        basics.setdefault(key, char)
    for alias, target in data["aliases"].items():
        if alias in chars:
            yield f"alias {alias!r} is also a character of the table"
        if target not in chars:
            yield f"alias {alias!r} points to {target!r}, which is not in the table"


def _glyph_errors(glyph: list[Json], reg: Registry, spec_ids: set[str]) -> Iterator[str]:
    for part in glyph:
        if part["shape"] not in spec_ids:
            yield f"shape {part['shape']!r} does not exist in spec/shapes"
            return
    use = [{"type": "use", "layer": "glyph", **part} for part in glyph]
    try:
        items = expand({"id": "leet", "primitives": use}, reg)
    except SpecError as exc:
        yield str(exc)
        return
    x0, y0, w, h = g.bbox(items, metrics.STROKE)
    x1, y1 = x0 + w, y0 + h
    if x0 < -EPS or y0 < -EPS or x1 > CANVAS + EPS or y1 > CANVAS + EPS:
        box = ", ".join(f"{v:g}" for v in (round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)))
        yield f"ink [{box}] leaves the 24 x 24 canvas"
