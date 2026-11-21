"""``deq-fonts``: build and check the Deq icon fonts and the Deq Leet font.

    deq-fonts codepoints [--check]    assign code points, write the code point tables
    deq-fonts build                   build every font, the CSS and the code point maps
    deq-fonts install-check [DIR]     install the fonts into a private fontconfig and list them
    deq-fonts ui-subset [--check]     write the site's Latin Extended-A subset of Noto Sans

The geometry comes from ``pnpm --filter @0xdolan/deq-icons font-data fonts/build/geometry.json``
and ``pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json`` (``just fonts``
runs every step).
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from deq_fonts.build import Shape, color_font, static_fonts, variable_font, write
from deq_fonts.leet import (
    LeetCodepoints,
    LeetScript,
    assign_leet,
    leet_codepoints_json,
    leet_css,
    leet_fonts,
    leet_table,
    load_leet,
    load_leet_codepoints,
)
from deq_fonts.ui import latin_ext_a
from deq_fonts.web import assign, codepoints_json, css, load_codepoints, table

ROOT = Path.cwd()
GEOMETRY = Path("fonts/build/geometry.json")
CODEPOINTS = Path("fonts/codepoints.json")
TABLE = Path("docs/fonts/codepoints.md")
LEET = Path("fonts/build/leet.json")
LEET_CODEPOINTS = Path("fonts/leet-codepoints.json")
LEET_TABLE = Path("docs/fonts/leet-codepoints.md")
DIST = Path("fonts/dist")
EXPECTED = {"Deq Icons", "Deq Icons Color", "Deq Leet"}
UI_SOURCE = Path(
    "apps/site/node_modules/@fontsource-variable/noto-sans/files/noto-sans-latin-ext-wght-normal.woff2"
)
UI_SUBSET = Path("apps/site/src/styles/fonts/noto-sans-latin-ext-a-wght-normal.woff2")


def load_shapes(path: Path) -> list[Shape]:
    if not path.exists():
        raise SystemExit(
            f"{path} not found: run `pnpm --filter @0xdolan/deq-icons font-data {path}`"
        )
    return [Shape.load(s) for s in json.loads(path.read_text(encoding="utf-8"))["shapes"]]


def version() -> str:
    """The font version from the monorepo version: 1.2.3 becomes 1.002."""
    data = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    major, minor, *_ = str(data["version"]).split(".")
    return f"{int(major)}.{int(minor):03d}"


def _leet_used(scripts: list[LeetScript], cps: LeetCodepoints) -> str:
    """The code points of the current table characters only."""
    used = {
        s.name: {
            g.char: {
                "basic": cps[s.name][g.char]["basic"],
                "advanced": cps[s.name][g.char]["advanced"][: len(g.advanced)],
                "full": cps[s.name][g.char]["full"],
            }
            for g in s.glyphs
        }
        for s in scripts
    }
    return leet_codepoints_json(used)


def cmd_codepoints(check: bool, geometry: Path, leet: Path) -> int:
    shapes = load_shapes(geometry)
    scripts = load_leet(leet)
    cps = assign([s.id for s in shapes], load_codepoints(CODEPOINTS))
    leet_cps = assign_leet(scripts, load_leet_codepoints(LEET_CODEPOINTS))
    files = {
        CODEPOINTS: codepoints_json(cps),
        TABLE: table(shapes, cps),
        LEET_CODEPOINTS: leet_codepoints_json(leet_cps),
        LEET_TABLE: leet_table(scripts, leet_cps),
    }
    stale = [p for p, text in files.items() if not p.exists() or p.read_text("utf-8") != text]
    if check:
        for p in stale:
            print(f"{p} is out of date: run `uv run deq-fonts codepoints`", file=sys.stderr)
        return 1 if stale else 0
    for p in stale:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(files[p], encoding="utf-8")
        print(f"wrote {p}")
    return 0


def cmd_build(geometry: Path, leet: Path, out: Path) -> int:
    shapes = load_shapes(geometry)
    scripts = load_leet(leet)
    cps = load_codepoints(CODEPOINTS)
    leet_cps = load_leet_codepoints(LEET_CODEPOINTS)
    ver = version()
    fonts = static_fonts(shapes, cps, ver)
    fonts["DeqIcons[DOTS,wght].ttf"] = variable_font(shapes, cps, ver)
    fonts["DeqIconsColor-Regular.ttf"] = color_font(shapes, cps, ver)
    fonts |= leet_fonts(scripts, leet_cps, ver)
    for path in write(fonts, out):
        print(f"wrote {path}")
    (out / "deq-icons.css").write_text(css(shapes, cps), encoding="utf-8")
    (out / "deq-leet.css").write_text(leet_css(), encoding="utf-8")
    used = {s.id: cps[s.id] for s in shapes}
    (out / "codepoints.json").write_text(codepoints_json(used), encoding="utf-8")
    (out / "leet-codepoints.json").write_text(_leet_used(scripts, leet_cps), encoding="utf-8")
    return 0


def _tool(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        raise SystemExit(f"{name} not found: install fontconfig")
    return path


def cmd_install_check(fonts: Path) -> int:
    """Copy the fonts into a temporary font directory with its own fontconfig file and check
    that fontconfig finds every family."""
    files = sorted(p for p in fonts.iterdir() if p.suffix in {".otf", ".ttf"})
    if not files:
        raise SystemExit(f"no fonts in {fonts}")
    with tempfile.TemporaryDirectory() as tmp:
        home = Path(tmp)
        target = home / "fonts"
        target.mkdir()
        for f in files:
            shutil.copy2(f, target / f.name)
        conf = home / "fonts.conf"
        conf.write_text(
            '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n'
            f"<fontconfig><dir>{target}</dir><cachedir>{home / 'cache'}</cachedir></fontconfig>\n",
            encoding="utf-8",
        )
        env = {"FONTCONFIG_FILE": str(conf), "HOME": tmp, "PATH": "/usr/bin:/bin"}
        subprocess.run([_tool("fc-cache"), "-f"], env=env, check=True, capture_output=True)  # noqa: S603
        listed = subprocess.run(  # noqa: S603
            [_tool("fc-list"), "--format", "%{family[0]}|%{style[0]}|%{file}\n"],
            env=env,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.splitlines()
    found = {line.split("|")[0] for line in listed}
    for line in sorted(listed):
        print(line)
    missing = EXPECTED - found
    if missing or len(listed) < len(files):
        print(f"fontconfig did not find: {sorted(missing) or 'every file'}", file=sys.stderr)
        return 1
    print(f"install-check: {len(files)} fonts found by fontconfig")
    return 0


def cmd_ui_subset(check: bool, source: Path, out: Path) -> int:
    if not source.exists():
        raise SystemExit(f"{source} not found: run `pnpm install`")
    data = latin_ext_a(source)
    if out.exists() and out.read_bytes() == data:
        return 0
    if check:
        print(f"{out} is out of date: run `uv run deq-fonts ui-subset`", file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    print(f"wrote {out} ({len(data)} bytes)")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="deq-fonts", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("codepoints", help="assign code points and write the table")
    p.add_argument("--check", action="store_true", help="fail if a file is out of date")
    p.add_argument("--geometry", type=Path, default=GEOMETRY)
    p.add_argument("--leet", type=Path, default=LEET)
    p = sub.add_parser("build", help="build the fonts and CSS")
    p.add_argument("--geometry", type=Path, default=GEOMETRY)
    p.add_argument("--leet", type=Path, default=LEET)
    p.add_argument("--out", type=Path, default=DIST)
    p = sub.add_parser("install-check", help="check that fontconfig finds the fonts")
    p.add_argument("fonts", nargs="?", type=Path, default=DIST)
    p = sub.add_parser("ui-subset", help="write the site's Latin Extended-A UI font subset")
    p.add_argument("--check", action="store_true", help="fail if the subset is out of date")
    p.add_argument("--source", type=Path, default=UI_SOURCE)
    p.add_argument("--out", type=Path, default=UI_SUBSET)
    args = parser.parse_args(argv)
    if args.command == "codepoints":
        return cmd_codepoints(args.check, args.geometry, args.leet)
    if args.command == "build":
        return cmd_build(args.geometry, args.leet, args.out)
    if args.command == "ui-subset":
        return cmd_ui_subset(args.check, args.source, args.out)
    return cmd_install_check(args.fonts)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
