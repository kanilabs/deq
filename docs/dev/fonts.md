---
title: Font pipeline
description: How the icon fonts and the Deq Leet font are built from the shapes, checked and released.
sidebar:
  order: 9
---

The fonts are built by `scripts/deq-fonts`, a private Python tool that uses fontTools ([ADR 0010](../decisions/0010-icon-packages-and-fonts.md), [ADR 0016](../decisions/0016-deq-leet-font.md)). How to use the fonts is in the [fonts guide](../guide/fonts.md) and the [font reference](../fonts/README.md).

## From shapes to fonts

```text
spec/ → core (built) → deq-icons font-data → fonts/build/geometry.json ─┐
                     → deq-generator font-data → fonts/build/leet.json ──┤
fonts/codepoints.json, fonts/leet-codepoints.json ───────────────────────┤
                                                                         └→ deq-fonts build → fonts/dist/
```

1. `pnpm --filter @0xdolan/deq-icons font-data fonts/build/geometry.json` writes the expanded geometry of every shape, taken from core.
2. `pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json` writes the Leet glyphs.
3. `uv run deq-fonts codepoints --check` fails when a shape or Leet character has no code point. `uv run deq-fonts codepoints` assigns the missing ones.
4. `uv run deq-fonts build` turns the strokes and dots into outlines and writes the fonts.

`just fonts` runs all four steps. The files in `fonts/build/` and `fonts/dist/` are gitignored.

## What is built

| File in `fonts/dist/`                     | What it is                                                         |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `DeqIcons-Regular.{otf,ttf,woff2}`        | The static icon font, with a ligature for every shape name         |
| `DeqIcons[DOTS,wght].{ttf,woff2}`         | The variable icon font: stroke weight and dot size axes            |
| `DeqIconsColor-Regular.{ttf,woff2}`       | The COLRv1 colour font with Light, Dark and Monochrome palettes    |
| `DeqLeet-Regular.{otf,ttf,woff2}`         | The monospaced Deq Leet font with `locl`, `ss01`–`ss03` and `salt` |
| `deq-icons.css`, `deq-leet.css`           | `@font-face` rules and classes for the web                         |
| `codepoints.json`, `leet-codepoints.json` | Copies of the code point tables                                    |

## Rules

- **Code points are permanent.** Icons use U+E000–U+EFFF and Leet glyphs start at U+F000. Never change or reuse one, even for a removed shape. Commit `fonts/codepoints.json`, `fonts/leet-codepoints.json` and their tables in `docs/fonts/` with the change that adds them.
- **Outlines keep the same structure** at every stroke width and dot size, because the variable font interpolates point by point. A new primitive kind needs an outline in `outline.py` and tests.
- **fontbakery must report no FAIL.** The accepted warnings are listed in ADR 0010 and ADR 0016; anything new needs a fix or a note in the ADR.
- **The licence** is GPL-3.0-or-later with the Font Exception (`fonts/LICENSE.md`), and the name table says so.

## Checks

```sh
just fonts-check   # fontbakery with ots on each file, then a fontconfig install check
uv run pytest scripts/deq-fonts/tests
```

The `fonts` CI job runs the same steps. Releases attach the built fonts as `deq-fonts-<version>.zip`; see [releasing](releasing.md). The website copies the web fonts into `/fonts/` at build time.
