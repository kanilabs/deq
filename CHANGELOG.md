# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with one unified version for all packages.

## [Unreleased]

### Added

- Phase 0 foundation: pnpm + Turborepo, Cargo and uv workspaces with placeholder packages (`@0xdolan/deq-*`, `deq-shapes`, `deq-cli`).
- Strict TypeScript, ESLint, Prettier, Ruff, mypy, rustfmt and clippy configuration.
- Local CI (`just ci`), git hooks (lefthook, commitlint, gitleaks) and a Docker CI image.
- GitHub Actions: CI on Linux, macOS and Windows; CodeQL; OpenSSF Scorecard; scheduled audits; Dependabot.
- pnpm override pinning `minimatch` to 11.0.3 (GHSA-g3hv-75wg-m249) until ESLint ships a patched dependency.
- Project documents: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, architecture decision records, AI rules and skills.
- Phase 1 research: bibliography of 34 sources (`content/sources.json`), cited research notes, URL status for every link, and an image attribution review in `docs/research/`.
- 47 images and 2 animations processed into metadata-free WebP masters, recorded with provenance and rights in `assets/source-manifest.json`.
- `scripts/deq-assets`: a private tool to inventory, process, verify and build responsive variants and contact sheets; `deq-assets verify` runs in `just test` and CI.
- Motif catalog with contact sheets (`docs/research/motif-catalog.md`): 45 approved motifs for Phase 2, plus 14 deferred until reference images exist.
- ADR 0006: image assets and provenance.
- Phase 2 shape spec (`spec/`): JSON Schemas for the grid, shapes, catalog and flag; the 24 × 24 grid with keylines; all 45 approved motifs as parametric shapes with layers, construction maths, names (needing native review) and cited metadata.
- The parametric 21-ray Kurdish Sun (`kurdish-sun`), with proportions taken from the flag.
- Flag of Kurdistan spec (`spec/flag.json`): geometry, colours in HEX, RGB, HSL, OKLCH and CMYK (Pantone pending verification), contrast pairs, variants and sizes, checked against the hash-pinned Wikimedia Commons SVG.
- Four symbol-only logo concepts in `assets/brand/concepts/`, shown mono and in flag colours in `docs/design/logo-concepts.svg`; the owner chose concept A, the chin mark.
- `scripts/deq-spec`: a private tool to lint, format, render and draw contact sheets; `deq-spec lint` runs in `just test` and CI.
- Shape spec guide (`docs/design/shape-spec.md`), shapes contact sheet and ADR 0007: shape spec format.
- Three sources: Wikipedia's articles on the flag and the Kurdish Sun, and the Commons flag SVG.
- Phase 3 `@0xdolan/deq-core`, the reference renderer:
  - `render`, `compose`, `getShape`, `listShapes`, `listCategories`, `hasShape`, `expand` and `resolveOptions`;
  - every render option with a documented default in `DEFAULT_OPTIONS`;
  - layer colours, and accessible `role="img"`, `<title>` and `aria-label` (or decorative `aria-hidden`);
  - runtime validation with valibot 1.5.0, and typed `DeqError` codes with "did you mean" suggestions for unknown shapes.
- Deterministic SVG output contract (rounding half to even to 3 decimals, fixed attribute order, exact right angles) and 278 golden fixtures in `spec/fixtures/` for the Python and Rust renderers to match (ADR 0008).
- Property tests with fast-check 4.10.2; core coverage is 100% of lines.
- Generated API reference `docs/api/core.md`, built with the TypeScript compiler API. TypeDoc was not added, because it needs a minimatch version affected by GHSA-g3hv-75wg-m249.
- Phase 4 `@0xdolan/deq-exporters` (ADR 0009):
  - `exportShapes(format, items, options)` for 23 formats: SVG, layered SVG (Inkscape layers), sprite, HTML, JSX, TSX, Vue, Svelte, data URI, CSS background and mask, PDF and AI (one Optional Content Group per layer, RGB or CMYK), EPS, PNG, JPG, WebP, AVIF, ICO, a favicon pack, PSD (one pixel layer per shape layer), Figma copy-as-SVG and re-importable spec JSON;
  - our own PDF and EPS writer instead of pdf-lib and svg2pdf.js; raster through `@resvg/resvg-wasm` 2.6.2 and the jSquash codecs; PSD through ag-psd 34.1.0;
  - a CSS Color 4 parser for colours in non-SVG formats, and `copyToClipboard` for pasting into Figma;
  - round-trip tests for every format: Ghostscript renders of PDF and EPS compared with resvg, Inkscape imports that check layer names, decoded raster images, PSD layers read back, and spec JSON checked against the schema.
- Core exports `prepare`, `svgDocument`, `composeShape` and `cosSin` for exporters, and an `@0xdolan/source` export condition for workspace type checking.
- CI job `exporter-tools` runs the exporter tests with Inkscape 1.4.3 and Ghostscript in Ubuntu 26.04, and `just test-tools` does the same locally.

### Changed

- The repository moved to the `kanilabs` organisation: repository, issue, badge and security links now point to `github.com/kanilabs/deq`, and the site, schema `$id`s and CSP allowlist to `kanilabs.github.io`. The npm scope stays `@0xdolan`.
- CI scans for secrets with the pinned, checksum-verified gitleaks CLI instead of `gitleaks-action`, which needs a paid licence for organisation repositories.
- Shape redesign after owner review: every shape is rebuilt from shared modules (circle, ring and bead radii, small and large dots, rays, small and large Vs drawn as two strokes, 45-degree pitch, teeth), with one layer and id per part, auto-centred. The modules are listed in `spec/grid.json`, and lint rejects circle or dot radii outside them.
- Redrawn: `roj-half-sun` (open arc, 7 rays by default, dot on the base), `roj-sun-circle`, `tree-branch`, `spike`, `wheat-arrow`, `crossed-chevrons`, `triangle-dotted`, `dimlich`, `dot-quincunx`, `ring-stem`, `band-border`, `gazelle`, `doll` (the head now joins the body), `fish`, `darek` (the bar only), `drower-union`, `chevron`, `fork`, `comb`, `chevron-stack`, `dot-rosette`, `sandgrouse-foot`, `spindle`, and the compositions, which now place shapes at full size.
- `kurdish-flag`: a `style` parameter (outline dividers broken symmetrically round the sun, or filled bands), with layers in flag-colour order.
- 51 new shapes split out of multi-design images, including `arch-dot-column` (the lower part of Drower's darek), `sun-rays`, `sun-double-ring`, `sun-forked-rays`, `sun-bar`, `cup-rays` and `bird`; the catalog now lists 93 shapes (97 with the brand concepts).
- Removed `hand-composition`, `foot-composition` and `vertical-stack`: each mixed several designs, which are now separate shapes.
- uv now refuses releases younger than 7 days (`exclude-newer`). The relock moved pip, platformdirs, py-serializable, Ruff and zizmor back to their previous releases.
