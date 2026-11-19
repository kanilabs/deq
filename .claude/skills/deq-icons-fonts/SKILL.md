---
name: deq-icons-fonts
description: Rules for the Deq icon packages (icons, react, vue, svelte, elements, CDN, sprite), the icon fonts (static, variable, colour, code points, ligatures) and the Deq Leet font. Use when changing any of them or adding a shape that must reach them.
---

# Deq icon packages and fonts

Phase 5, ADR 0010; the Leet font is Phase 9c, ADR 0016. Usage docs: `packages/<name>/README.md`, `docs/cdn.md`, `docs/fonts/README.md`.

## Icon packages

- Data flows one way: `spec/` → core → `@0xdolan/deq-icons` (generated nodes and SVG strings) → react, vue, svelte (generated components) and elements. Never hand-edit `src/generated/`; run `pnpm --filter @0xdolan/deq-<name> generate`. Tests fail when a generated file is stale.
- Icon options only change root attributes (`size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, `title`). Build them with `rootAttributes` from deq-icons; never re-implement it. With default options, every package must equal core's `render` byte for byte (tests check all 93 shapes).
- Accessibility: a title gives `role="img"` + `aria-label` + `<title>`; `title=""` gives `aria-hidden="true"`.
- Custom element: light DOM, drawn with `createElementNS` (no `innerHTML`). Lifecycle callbacks swallow `DeqError` and leave the element empty; `update()` throws.
- CDN: `pnpm --filter @0xdolan/deq-elements build` writes `dist/cdn/deq-elements.js` and `dist/integrity.json` (SHA-384). Keep `docs/cdn.md` in step; never recommend `/+esm` with SRI.
- `examples/<fw>` are private Vite apps that build and test against the packages' `dist`. A new public API should appear in an example.

## Fonts (`scripts/deq-fonts`, Python)

- Build: `just fonts`. Full check: `just fonts-check` (fontbakery with ots on each file separately, then `deq-fonts install-check`). The `fonts` CI job runs the same steps.
- New shape: run `pnpm --filter @0xdolan/deq-icons font-data fonts/build/geometry.json`, then `uv run deq-fonts codepoints` and commit `fonts/codepoints.json` and `docs/fonts/codepoints.md`. **Never change or reuse a code point**, even for a removed shape.
- Outlines must keep the same contour structure at every stroke width and dot scale (masters interpolate point by point). New item kinds go in `outline.py` with tests.
- fontbakery must report no FAIL on any file. The accepted WARNs are listed in ADR 0010; anything new needs a fix or an ADR note.
- Colour layers: `top` → red, `bottom` → green, `sun` → yellow, `frame` → ink; other layers cycle red, green, yellow. Palettes: Light, Dark, Monochrome (CPAL types 1, 2, 1).
- License: GPL-3.0-or-later with the Font Exception (`fonts/LICENSE.md`); the name table carries it.
- Font binaries are never committed (`fonts/dist/` and `fonts/build/` are gitignored); releases attach them.
- Leet font (`leet.py`, ADR 0016): geometry from `pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json` (needs the generator built). Every glyph is 26 units wide (monospaced). The cmap gives the basic glyph for each character, its lower case and its aliases; GSUB has `locl` (arab: shared characters and ASCII digits → `.ar`/Sorani glyphs), `ss01`/`ss02` (advanced alternatives), `ss03` (full) and `salt`. No `ccmp` or mark glyphs: shapers compose decomposed input. Never map zero-width characters such as tatweel.
- Leet code points: U+F000–U+F8FF in `fonts/leet-codepoints.json` (`{script: {char: {basic, advanced, full}}}`), assigned by `uv run deq-fonts codepoints` in table order; commit it with `docs/fonts/leet-codepoints.md`. Icons stay in U+E000–U+EFFF. Never change or reuse one.
- fontbakery 1.1.0 crashes in `opentype/monospace` on CFF fonts, so `DeqLeet-Regular.otf` runs with `-x opentype/monospace` (justfile and CI); the TTF runs every check. Accepted Leet WARNs are in ADR 0016.
- Tests: `uv run pytest scripts/deq-fonts/tests` with synthetic shapes and Leet data in `tests/fonts_samples.py`. Don't add a `conftest.py` or `__init__.py` there: they clash with the other `tests` folders under pytest and mypy.
