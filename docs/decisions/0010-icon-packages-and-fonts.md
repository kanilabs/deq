# 10. Icon packages and fonts

- Status: accepted
- Date: 2026-11-16

## Context

Phase 5 ships the shapes as everyday icons: a data package, components for React, Vue and Svelte, a custom element with a CDN build, a sprite, and icon fonts (static, variable and colour) per PRD §8.7 and §8.8. Every output must look like core's `render`, stay small in bundles, and be checked automatically. The fonts must pass fontbakery with no FAILs and install on Linux.

## Decision

### Icon packages

- **Precomputed data.** `@0xdolan/deq-icons` stores each shape as Lucide-style nodes (`[tag, attrs][]`) rendered by core with default options, plus SVG strings (`/svg`), one file per icon (`/svg/<id>.svg`), `sprite.svg` and `icons.json`. Generated files are checked fresh by tests.
- **Options change root attributes only:** `size`, `color`, `strokeWidth`, `absoluteStrokeWidth` and `title`. Geometry never changes, so no package re-runs the renderer; dot scale, rotation, fills and parameters stay in `@0xdolan/deq-core`. `rootAttributes` in deq-icons is the single source of the root markup, and with default options every package writes core's output byte for byte.
- **One component per icon.** React, Vue and Svelte export a named, tree-shakeable component per icon (`RojHalfSun`, marked `/*#__PURE__*/`) and a dynamic `DeqIcon` by name. Peer ranges: React ≥ 19, Vue ≥ 3.5, Svelte ≥ 5. Unknown names throw `DeqError("UNKNOWN_SHAPE")`.
- **Custom element in the light DOM.** `<deq-icon>` from `@0xdolan/deq-elements` draws with DOM calls (no `innerHTML`), so CSS `color` and selectors work and no markup is parsed. Lifecycle callbacks leave the element empty on bad attributes instead of throwing; `update()` throws. The class is SSR-safe (`globalThis.HTMLElement ?? Object`). `/define` registers the tag; `/cdn` is a minified ES bundle (Vite library build, about 9 kB gzipped).
- **CDN with SRI.** The elements and icons packages publish `integrity.json` with SHA-384 hashes of their CDN files; `docs/cdn.md` shows jsDelivr and unpkg tags with `integrity` and `crossorigin`, and warns that `/+esm` rewrites files and breaks SRI.
- **Example apps** in `examples/` (React, Vue, Svelte, plain elements) build with Vite from the published `dist` outputs and test that the icons render, as part of `pnpm build` and `pnpm test`.

### Fonts

- **Built with fontTools in Python** (`scripts/deq-fonts`, private): `fonttools[woff]` 4.68.0 and `skia-pathops` 0.9.2 for overlap removal. The geometry comes from core (`expand`) through `pnpm --filter @0xdolan/deq-icons font-data`, so fonts never re-implement shape logic.
- **Outlines.** Every stroke becomes overlapping simple contours: a round-capped capsule per line segment, a ring per circle, a round-capped band per arc, dots as filled circles. Curves in paths are flattened to fixed piece counts. Points depend linearly on the stroke width and the contour structure never does, so masters interpolate exactly. The 24-unit canvas maps to a 960-unit em (40 units per canvas unit), baseline at canvas row 19.
- **Static** `DeqIcons-Regular` (OTF with CFF, TTF, WOFF2) at stroke 2, overlaps removed.
- **Variable** `DeqIcons[DOTS,wght]`: masters at `wght` 100, 400 and 900 (stroke 0.5, 2, 3) and `DOTS` 50 and 200 (dot radius in percent), with overlapping contours flagged (`OVERLAP_SIMPLE`), nine named instances and a STAT table. A custom `DOTS` axis follows the PRD's suggestion.
- **Colour** `DeqIconsColor-Regular`: COLRv1 (`PaintColrLayers` of `PaintGlyph` + `PaintSolid`) with one layer glyph per shape layer, three CPAL palettes (Light, Dark, Monochrome) in flag colours, and an OT-SVG table in the light palette as the fallback.
- **Code points and ligatures.** Private Use Area code points from U+E000 live in `fonts/codepoints.json`; a value is never changed or reused, and new shapes take the next free one. Ligatures map ids, then aliases, then ASCII Kurmanji names to glyphs (the first shape in catalog order wins a shared name) through one lookup used by both `liga` and `calt`. Capitals map to the lowercase letter glyphs, so `Roj` also ligates. Monoline letters a–z, 0–9 and `-` keep unfinished names readable.
- **License:** GPL-3.0-or-later with the GPL Font Exception (`fonts/LICENSE.md`), chosen by the owner, so documents and sites that embed the fonts are not covered by the GPL.
- **No text font** in this phase (owner's choice); Deq Leet stays in Phase 9.
- **Verification.** pytest covers the builder at 100% of lines with HarfBuzz shaping checks. The `fonts` CI job builds the fonts, checks that the code point table is fresh, runs `fontbakery check-universal` on each file separately (it includes ots; the static, variable and colour fonts are separate families, so a joint run reports false family mismatches), and installs them into a private fontconfig (`deq-fonts install-check`). The colour palettes were also checked by rendering in Chrome.
- **Release artifacts.** Font binaries are gitignored and attached to GitHub releases.

## Consequences

- Accepted fontbakery WARNs: UPM 960 is not a power of two (it keeps the grid at whole units), no kerning (icons are fixed-width), no ligature carets, no `avar` (the weight-to-stroke map is linear by design), and overlapping segments in the variable masters (needed for interpolation).
- Fonts are unhinted, with smart dropout control in `prep` and a `gasp` table; small sizes rely on the renderer's anti-aliasing.
- The colour font is about 36 kB as WOFF2 because each shape layer is a separate glyph.
- Changing an icon's geometry changes the fonts in the next release; changing its code point would break users, which the never-reuse rule and `codepoints --check` prevent.
