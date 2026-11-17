---
name: deq-icons-fonts
description: Rules for the Deq icon packages (icons, react, vue, svelte, elements, CDN, sprite) and the icon fonts (static, variable, colour, code points, ligatures). Use when changing any of them or adding a shape that must reach them.
---

# Deq icon packages and fonts

Phase 5, ADR 0010. Usage docs: `packages/<name>/README.md`, `docs/cdn.md`, `docs/fonts/README.md`.

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
- Tests: `uv run pytest scripts/deq-fonts/tests` with synthetic shapes in `tests/fonts_samples.py`. Don't add a `conftest.py` or `__init__.py` there: they clash with the other `tests` folders under pytest and mypy.
