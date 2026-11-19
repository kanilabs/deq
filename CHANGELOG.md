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
- Phase 5 icon packages (ADR 0010):
  - `@0xdolan/deq-icons`: icon data for all 93 shapes, SVG strings, one SVG file per icon, `sprite.svg`, `icons.json` and `toSvg` with `size`, `color`, `strokeWidth`, `absoluteStrokeWidth` and `title`; default output equals core's `render` byte for byte;
  - `@0xdolan/deq-react`, `@0xdolan/deq-vue` and `@0xdolan/deq-svelte`: a tree-shakeable component per icon and a dynamic `DeqIcon` by name;
  - `@0xdolan/deq-elements`: the `<deq-icon>` custom element (light DOM, SSR-safe), a `/define` entry and a minified CDN bundle (about 9 kB gzipped);
  - `integrity.json` with SHA-384 hashes in the icons and elements packages, and CDN docs with SRI (`docs/cdn.md`);
  - example apps for React, Vue, Svelte and plain HTML in `examples/`, built and tested in CI.
- Phase 5 icon fonts, built with fontTools by the private `scripts/deq-fonts` tool:
  - Deq Icons (OTF, TTF, WOFF2), with a Private Use Area code point per icon from U+E000 and ligatures for ids, aliases and Kurmanji names (typing `roj` shows the half sun);
  - Deq Icons variable font with a `wght` axis (stroke 0.5 to 3) and a `DOTS` axis (dot size 50% to 200%), nine named instances;
  - Deq Icons Color: COLRv1 with Light, Dark and Monochrome CPAL palettes in the flag colours, plus an OT-SVG fallback;
  - `deq-icons.css`, `fonts/codepoints.json` and the code point table `docs/fonts/codepoints.md`; usage and install guide in `docs/fonts/README.md`;
  - licensed GPL-3.0-or-later with the GPL Font Exception (`fonts/LICENSE.md`);
  - `just fonts` and `just fonts-check`, and a `fonts` CI job that runs fontbakery (with ots, no FAILs) and a fontconfig install check.
- Phase 6 ports and CLIs (ADR 0011):
  - `renderFlag`, `flagSize`, `listFlagVariants` and `FLAG` in `@0xdolan/deq-core`, with flag cases in the golden fixtures;
  - Python `deq-shapes` (import `deq_shapes`) and the Rust crate `deq-shapes`: the full renderer (`render`, `compose`, `render_flag`, registry, options and errors), matching all 287 golden fixtures byte for byte, plus exporters for `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp` and `ico`;
  - the `deq` CLI in Node (`@0xdolan/deq-cli`, every format), Python (script `deq`) and Rust (crate `deq-cli`), with `list`, `info`, `render`, `export`, `flag`, `validate` and `completion`; formats outside the core subset exit with code 4 in Python and Rust and point to the Node CLI;
  - `spec/cli.json`, the shared CLI interface, generating help texts and bash, zsh, fish and PowerShell completions for all three CLIs;
  - 84 shared CLI cases (`spec/fixtures/cli-cases.json`) recorded from the Node CLI in `spec/fixtures/cli/` and run by the Python and Rust tests on Linux, macOS and Windows.
- Phase 7 website foundation in `apps/site` (ADR 0012):
  - Astro 7 + Starlight with light, dark and system themes, flag-green accents checked for contrast, and self-hosted Noto Sans and Vazirmatn;
  - English, Sorani (`ckb`, right-to-left) and Kurmanji (`kmr`) with typed message catalogs that fail the type check on a missing key; the Kurdish text is AI-drafted and every ckb and kmr page says it needs native review;
  - Home, Icons (filterable gallery) and a page per icon with preview, sizes, names, parameters, code point, usage and SVG download; Flag, Fonts (specimens and a weight slider), Brand, About, Docs (getting started, packages, CLI) and a 404 page;
  - SEO: Open Graph and Twitter images per page and per icon rendered at build time, JSON-LD, sitemap with hreflang, `robots.txt`, `llms.txt` and `llms-full.txt`;
  - a strict `<meta>` CSP with hashes for every script, including Starlight's inline ones;
  - an installable PWA: manifest with app icons from the chin mark, a Workbox service worker that precaches every page for offline use, and an update prompt;
  - Vitest unit tests, a Playwright suite (axe, CSP, RTL, JavaScript budget, theme, search, offline) and a Lighthouse gate (every category ≥ 95), run by the new `site` CI job and `just site`;
  - the `Pages` workflow: `develop` deploys a preview until `PAGES_PRODUCTION` is set, releases deploy production.
- The Deq logo: the Dot rosette in the Kanî Labs badge, with mark, dark, mono, small-size and favicon SVGs and a social preview card, all generated from `spec/shapes/dot-rosette.json` by `uv run deq-spec brand` and checked fresh by `deq-spec lint`; `just brand` renders PNGs for GitHub and social media (ADR 0013).
- Phase 8a Studio at `/studio/` in every locale (ADR 0014), built with Svelte 5:
  - an infinite canvas with pan, pinch and wheel zoom, fit, rulers, an 8 px snap grid with guides to other shapes, and overlays for the 24-unit design grid, keylines and a pixel preview;
  - a library searchable by English, Sorani and Kurmanji names, aliases and tags, filtered by category, adding by click, Enter or drag;
  - an inspector for every render option, shape parameter and layer colour, with previews at 16 to 96 px, per-option reset, reset shape and reset all;
  - undo and redo with merged edits, autosave to local storage, and 25 documented, remappable keyboard shortcuts;
  - a tab bar on narrow screens, unit tests and Playwright tests on desktop and a Pixel 7 viewport.
- Phase 8b Studio multi-select, batch editing and layers (ADR 0014):
  - select several shapes with Shift-click, a marquee drag on the background, the layers panel or select all; Space-drag, the middle button and touch pan;
  - batch editing in the inspector: one edit changes every selected shape in one undo step, and fields where the shapes differ show "Mixed";
  - align to six edges, distribute horizontally or vertically, bring forward, send backward, bring to front, send to back, group, ungroup, lock and hide;
  - a layers panel beside the library: rows top first, with select, lock, hide, move up and move down;
  - 16 new shortcut actions (41 in total), with defaults for group, ungroup, layer order, lock and hide.
- Phase 8c Studio custom shapes (ADR 0014):
  - a full-pane shape editor on the 24-unit grid with path, line, circle, polygon, rect, dot and catalog-shape parts, a parts list, properties and its own undo;
  - a path editor to drag, add and delete points, curve segments and close paths, plus move, duplicate, flip, mirror, rotate, scale and layer order;
  - unite, subtract, intersect and exclude on closed parts with paper.js 0.12.18, loaded on first use;
  - radial and repeat arrays that can be unwrapped into parts;
  - a "My shapes" library section saved in IndexedDB, with spec JSON export and import, edit and delete; designs embed the custom shapes they use.
- Phase 8d Studio import, share links and export (ADR 0014):
  - export of the selection or all visible shapes in all 23 formats, one file per shape, with several files packed into a ZIP; raster formats run resvg and jSquash as WebAssembly, allowed by `'wasm-unsafe-eval'` on the Studio pages only;
  - `DataItem` in `@0xdolan/deq-exporters`: shapes given as validated spec data, so custom shapes export in every format;
  - share links that hold the compressed design in the URL fragment (capped at 16,000 characters), with a copyable field when the clipboard is refused;
  - Save and Open for design files, plus custom shape specs and SVG files, with Open, Save, Share and Export in the toolbar and on shortcuts;
  - SVG import that rebuilds the file from an allowlist of geometry, fits it into the keylines and adds it to My shapes, leaving out gradients, text, images and effects with a notice;
  - end-to-end tests for every export format, files, SVG import and share links on desktop and mobile.
- Phase 9a Deq Leet and the pattern generator (ADR 0015):
  - Leet tables for Latin and Kurmanji (50 characters, digits as dot counts) and Sorani (49 characters, RTL) in `spec/leet/`, with a schema, aliases and `deq-spec lint` rules for readability, canvas bounds and unique basic glyphs;
  - `@0xdolan/deq-generator`: `leet` at the basic, advanced (seeded) and full levels with one layer per character, `decodeLeet` for basic output, and `pattern` for seeded bands, grids, rosettes and borders, all with capped plain-text input;
  - `svgRoot` in `@0xdolan/deq-core` for scenes wider than one shape;
  - 28 golden Leet and pattern fixtures in `spec/fixtures/leet/` for the ports, and the mapping chart `docs/design/leet-chart.svg`.

### Changed

- The site's header logo, favicon, app icons, share-card mark and Brand page use the Dot rosette instead of the chin mark (concept A).
- cargo-deny allows the IJG licence for the `jpeg-encoder` crate only (permissive and GPL-compatible).
- The repository moved to the `kanilabs` organisation: repository, issue, badge and security links now point to `github.com/kanilabs/deq`, and the site, schema `$id`s and CSP allowlist to `kanilabs.github.io`. The npm scope stays `@0xdolan`.
- CI scans for secrets with the pinned, checksum-verified gitleaks CLI instead of `gitleaks-action`, which needs a paid licence for organisation repositories.
- Shape redesign after owner review: every shape is rebuilt from shared modules (circle, ring and bead radii, small and large dots, rays, small and large Vs drawn as two strokes, 45-degree pitch, teeth), with one layer and id per part, auto-centred. The modules are listed in `spec/grid.json`, and lint rejects circle or dot radii outside them.
- Redrawn: `roj-half-sun` (open arc, 7 rays by default, dot on the base), `roj-sun-circle`, `tree-branch`, `spike`, `wheat-arrow`, `crossed-chevrons`, `triangle-dotted`, `dimlich`, `dot-quincunx`, `ring-stem`, `band-border`, `gazelle`, `doll` (the head now joins the body), `fish`, `darek` (the bar only), `drower-union`, `chevron`, `fork`, `comb`, `chevron-stack`, `dot-rosette`, `sandgrouse-foot`, `spindle`, and the compositions, which now place shapes at full size.
- `kurdish-flag`: a `style` parameter (outline dividers broken symmetrically round the sun, or filled bands), with layers in flag-colour order.
- 51 new shapes split out of multi-design images, including `arch-dot-column` (the lower part of Drower's darek), `sun-rays`, `sun-double-ring`, `sun-forked-rays`, `sun-bar`, `cup-rays` and `bird`; the catalog now lists 93 shapes (97 with the brand concepts).
- Removed `hand-composition`, `foot-composition` and `vertical-stack`: each mixed several designs, which are now separate shapes.
- uv now refuses releases younger than 7 days (`exclude-newer`). The relock moved pip, platformdirs, py-serializable, Ruff and zizmor back to their previous releases.
- The repository ESLint run gets a 6 GB heap, and `.svelte-kit/` is ignored, for the extra TypeScript projects.
- ESLint and Prettier ignore Astro's generated `.astro/` folder and Playwright output; `pnpm lint` runs `astro sync` first so the site's types exist on a clean checkout.
- pnpm override `workbox-build>glob` to 14.0.4: glob 11 finds no files with the `minimatch` 11.0.3 override. Remove it when `workbox-build` depends on glob 14+.
- `pnpm audit` and dependency review allow GHSA-fc5q-39xc-vjpf (picomatch ReDoS, no patched release, build tools only); remove when a fix ships (ADR 0004).
