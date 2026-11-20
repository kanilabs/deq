# Deq: project rules for AI agents

Deq turns traditional Kurdish tattoo (deq) motifs into an open, parametric design system: shape spec, renderers in TS/Python/Rust, exporters, icon packages, fonts, a website with Studio, and a cited cultural story. The full plan is in `PRD-detailed.md` (local only, never committed). Current phase: **10a done** (Phase 2: shape spec, flag, logo concept A, 93 shapes approved with all variations, small fixes may follow. Phase 3: `@0xdolan/deq-core` reference renderer with all render options, golden fixtures in `spec/fixtures/` and the generated API reference. Phase 4: `@0xdolan/deq-exporters` with 23 formats, layered PDF/AI/PSD/SVG verified in Inkscape and Ghostscript (ADR 0009). Phase 5: icon packages (icons, react, vue, svelte, elements with a CDN build and SRI), example apps, and the static, variable and COLRv1 icon fonts passing fontbakery (ADR 0010); Phase 6: Python and Rust `deq-shapes` ports matching all golden fixtures, and the `deq` CLI in Node, Python and Rust from the shared `spec/cli.json`, replaying 84 shared CLI cases on three OSes (ADR 0011); Phase 7: the website in `apps/site` (Astro + Starlight, en/ckb/kmr with RTL, themes, icon pages, SEO, hashed `<meta>` CSP, Workbox PWA, Playwright/axe/Lighthouse checks, Pages workflow; ADR 0012); Phase 8a: Studio canvas, library, inspector, undo and shortcuts in Svelte 5 (ADR 0014); Phase 8b: multi-select, marquee, batch editing, align/distribute, flat groups, layer order, lock/hide and the layers panel; Phase 8c: custom shapes in a shape editor, the path editor, paper.js booleans and "My shapes" in IndexedDB; Phase 8d: SVG import through an allowlist rebuild, design files, share links in the URL fragment, export of every format (one file per item, ZIP for several, `DataItem` in the exporters) and the full E2E suite on desktop and mobile; Phase 9a: Deq Leet tables in `spec/leet/` with lint, and `@0xdolan/deq-generator` with Leet, decode, seeded patterns, golden fixtures in `spec/fixtures/leet/` and the chart (ADR 0015); Phase 9b: Python and Rust ports of the generator with fdlibm trig parity, and `deq leet`/`deq generate` in the three CLIs with `omit` in `spec/cli.json`; Phase 9c: the monospaced Deq Leet font with `locl`, `ss01`–`ss03`, `salt` and PUA code points from U+F000 in `fonts/leet-codepoints.json`, passing fontbakery (ADR 0016); Phase 9d: `/leet` and `/generate` pages and Studio tabs sharing one set of panels, frames, PUA font text, decode, and scene export with one layer per glyph (ADR 0017); Phase 10a: the cited nine-chapter story in three locales, the sources page, responsive media, the lightbox, the YouTube facade and the link check (ADR 0018). Next: Phase 10b, the showcase).

## Hard rules

- **Never commit** `temp/`, `PRD`, `PRD-detailed.md`. They are gitignored, blocked by a pre-commit hook (`just forbidden`) and checked in CI.
- **Attribution**: every commit is authored by `0xdolan <0xdolan@gmail.com>`. Never add Claude, Anthropic or any AI as author or co-author; no "Generated with" lines in commits, PRs, issues, files or release notes. commitlint enforces this.
- **Gitflow**: work on `feature/*` (or `fix/*`, `docs/*`, `chore/*`) off `develop`, PR into `develop` with green CI. `release/x.y.z` and `hotfix/x.y.z` merge into `main` and back into `develop`. Pushing is allowed; ask before force-pushing, deleting branches or tags, publishing packages, or weakening repository settings.
- **Security first**: follow `.claude/skills/deq-security/SKILL.md` for every change.
- **One phase at a time**: implement only the requested phase; ask about anything ambiguous.
- **Keep these rules current**: at the end of each phase or change request, update this file, the skills in `.claude/skills/` and `CHANGELOG.md` (Unreleased).

## Commands

| Task                                  | Command                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Install everything, enable hooks      | `just setup`                                                                           |
| Full local CI (same as GitHub)        | `just ci`                                                                              |
| Stages                                | `just lint`, `just typecheck`, `just test`, `just build`, `just audit`, `just secrets` |
| Format                                | `just fmt`                                                                             |
| Image assets                          | `uv run deq-assets {inventory,process,verify,variants,contact-sheet}`                  |
| Shape spec                            | `uv run deq-spec {lint,fmt,render,sheet}` (guide: `docs/design/shape-spec.md`)         |
| Brand SVGs (+ PNGs with `just brand`) | `uv run deq-spec brand` (ADR 0013)                                                     |
| Core data, fixtures, API docs         | `pnpm --filter @0xdolan/deq-core {generate,fixtures,docs}` (ADR 0008)                  |
| Exporter tests with Inkscape/gs       | `just test-tools` (needs Inkscape 1.4+ and Ghostscript)                                |
| Icon data and components              | `pnpm --filter @0xdolan/deq-{icons,react,vue,svelte} generate`                         |
| Fonts (icons and Leet)                | `just fonts`; `just fonts-check` adds fontbakery, ots and a fontconfig install check   |
| New shape or Leet code points         | `uv run deq-fonts codepoints` (never change or reuse one)                              |
| Leet font geometry                    | `pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json` (ADR 0016)      |
| Leet tables, fixtures and chart       | `pnpm --filter @0xdolan/deq-generator {generate,fixtures}` (ADR 0015)                  |
| CLI help/completions, CLI cases       | `pnpm --filter @0xdolan/deq-cli {generate,fixtures}` (ADR 0011)                        |
| Story image variants                  | `just media` (`deq-assets variants` into `assets/.generated/`)                         |
| Site internal links (after build)     | `pnpm --filter @0xdolan/deq-site links` (`--external` lists outside URLs)              |
| Website checks (e2e, Lighthouse)      | `just site` (fonts, media, build, links, Playwright + axe + offline, Lighthouse ≥ 95)  |
| CI in Docker                          | `just docker-ci`                                                                       |

## Layout

- `packages/<name>` → npm `@0xdolan/deq-<name>` (core, icons, react, vue, svelte, elements, exporters, generator, cli). TS 6.0 strict, built with `tsc`, tested with Vitest (coverage ≥ 95% lines).
- `python/deq-shapes` → PyPI `deq-shapes`, import `deq_shapes`, script `deq`. uv workspace, mypy --strict, Ruff, pytest (coverage ≥ 95%).
- Ports (ADR 0011): Python and Rust re-implement core and must match `spec/fixtures/` byte for byte; they export `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp`, `ico` and exit 4 for other formats. Data comes from generated `data/*.json` files.
- `spec/cli.json` is the shared CLI interface; `spec/fixtures/cli-cases.json` → `spec/fixtures/cli/` (recorded from the Node CLI) is replayed by every CLI.
- `rust/deq-shapes`, `rust/deq-cli` (binary `deq`) → crates.io. Edition 2024, MSRV 1.85, toolchain pinned 1.99.1, `unsafe` forbidden, clippy pedantic, no unwrap/expect/panic.
- `assets/`: WebP masters in `images/` and `video/`, plus `source-manifest.json` (provenance of every image). Variants go to the gitignored `assets/.generated/`.
- `content/sources.json`: the bibliography (CSL-JSON). `docs/research/`: notes, URL status, attribution review and the motif catalog.
- `scripts/deq-assets`: the private image tool (uv workspace, not published).
- `spec/`: the single source of truth for shapes (ADR 0007): `grid.json`, `shapes/<id>.json`, `catalog.json`, `flag.json`, `schema/`, hash-pinned `reference/`. Metrics and `docs/design/*.svg` sheets are generated by `scripts/deq-spec`. `fixtures/` holds the golden SVGs every renderer must match byte for byte (ADR 0008), generated by `packages/core`.
- `assets/brand/`: the logo, the Dot rosette in the Kanî badge (ADR 0013), generated by `scripts/deq-spec/src/deq_spec/brand.py`; `concepts/` keeps the old logo concepts in the shape format (category `brand`).
- `packages/generator` (ADR 0015): `leet`, `decodeLeet`, `pattern`, `sceneSvg` and the mulberry32 `Random`. Tables come from `spec/leet/{latin,sorani}.json` (schema `spec/schema/leet.schema.json`, checked by `deq-spec lint`) into `src/generated/leet.ts`. Scenes are core's `svgRoot` plus one `<g data-layer="cN" transform="translate(x y)">` per cell; Leet adds `data-deq-leet` to the root. Fixtures in `spec/fixtures/leet/` and `docs/design/leet-chart.svg` are written from `dist/`; the script also writes `leet.json` for the ports. Ports: Python `rng.py`, `scene.py`, `leet.py`, `patterns.py`, `_trig.py`; Rust `random.rs`, `scene.rs`, `leet.rs`, `generate.rs`, `trig.rs` (fdlibm `sin`/`cos`, so rotations match V8). Guide: `docs/design/leet.md`.
- `packages/exporters`: `exportShapes(format, items, options)`; own PDF/EPS writer, resvg + jSquash WASM raster, ag-psd. Tests needing Ghostscript or Inkscape skip unless installed (`DEQ_REQUIRE_TOOLS=1` in the `exporter-tools` CI job).
- `packages/core` is the reference renderer: `src/generated/shapes.ts` (built from `spec/`), valibot option validation, `DeqError` codes. Generated files (`src/generated/`, `spec/fixtures/`, `docs/api/`) are Prettier-ignored and checked fresh by tests.
- `packages/icons` (data, SVG strings, sprite), `react`, `vue`, `svelte` (generated per-icon components), `elements` (`<deq-icon>`, CDN bundle and `integrity.json`). Default output equals core's `render` byte for byte (ADR 0010).
- `examples/<fw>`: private Vite apps that build and test against the packages' `dist`.
- `scripts/deq-fonts`: the private font builder (fontTools). `fonts/codepoints.json` (committed, icon PUA U+E000–U+EFFF), `fonts/leet-codepoints.json` (committed, Leet PUA from U+F000, built by `leet.py`, ADR 0016), `fonts/LICENSE.md` (GPL + Font Exception); built fonts go to the gitignored `fonts/dist/`. Guide: `docs/fonts/README.md`.
- `apps/site` → private `@0xdolan/deq-site` (ADR 0012): Astro 7 + Starlight. Own pages in `src/pages/[...locale]/` via `StarlightPage`; typed catalogs in `src/i18n/messages/` (`en.ts` defines the keys); build integrations `fonts` → `csp` (inline-script hashes) → `pwa` (Workbox), in that order. `DEQ_REQUIRE_FONTS=1` fails the build without `fonts/dist`. Pages deploys `develop` while repo variable `PAGES_PRODUCTION` ≠ `true`, releases always.
- `apps/site/src/studio/` (ADR 0014): plain TS modules (`model`, `history`, `search`, `snap`, `arrange`, `shortcuts`, `i18n`, `render`, `svg`; 8c adds `custom`, `shapes`, `geometry`, `pathedit`, `boolean`; 8d adds `svgimport`, `share`, `zip`, `exporting`, `files`) unit-tested in `test/studio.test.ts`, `test/shapes.test.ts`, `test/io.test.ts` and `test/svgimport.test.ts` (happy-dom with a canvas stub), browser glue in `db.ts` (IndexedDB, downloads; e2e only), the shape editor state `editor.svelte.ts` with `components/ShapeEditor.svelte`, the reactive `Studio` class in `store.svelte.ts`, and Svelte 5 components in `components/` mounted with `client:only="svelte"` by `src/pages/[...locale]/studio.astro`. `components/ExportDialog.svelte` loads the resvg WASM before raster exports, and `integrations/csp.ts` adds `'wasm-unsafe-eval'` to the Studio pages only. Validate any outside design with `parseDoc`, any custom shape with `parseCustomDef`, any SVG with `sanitizeSvg` and any share link with `decodeShare`; resolve shapes through `shapeOf` (catalog or custom); insert SVG only through `svg.ts`. `typecheck` runs `astro check` and `svelte-check`; e2e has a `mobile` project for `studio.spec.ts` and `leet.spec.ts`.
- Leet and patterns on the site (ADR 0017): `src/studio/generate.ts` (`composeLeet` with band/border frames, `puaText`, `insertScene`, `styleOptions`; tested in `test/generate.test.ts`), `formats.ts` (format lists without runtime imports, `SCENE_FORMAT_GROUPS`), and the shared panels `LeetPanel.svelte`, `GeneratePanel.svelte`, `SceneStyle.svelte`, `SceneExport.svelte` (loads the exporters on the first download) with styles in `panel.css`. `mode="page"` on `src/pages/[...locale]/{leet,generate}.astro`, `mode="studio"` in the Studio's Leet and Patterns side tabs (`Studio.insertScene`, one undo step). `WASM_PAGES` in `integrations/csp.ts` covers studio, leet and generate.
- Story and sources (ADR 0018): chapters in `content/story/<locale>/NN-<slug>.mdx` (collection `story` in `src/content.config.ts`), captions and alt text in `content/story/images.json`, data helpers in `src/lib/story.ts` (`CHAPTERS`, `pictureOf`, `citeLabel`, `tileSizes`), MDX components `Cite`, `Figure`, `Gallery`, `YouTube`, `SiteLink` and `Lightbox` in `src/components/story/`, pages `story/index.astro`, `story/[chapter].astro` and `sources.astro`, styles in `src/styles/story.css`. The `media` integration copies `assets/.generated/` variants and animated masters to `dist/media/` (`DEQ_REQUIRE_MEDIA=1` fails without them). `apps/site/turbo.json` declares the build's env and inputs. Tests: `test/story.test.ts`, `e2e/links.ts`.
- `docs/` (guides, `api/` generated reference, ADRs in `docs/decisions/`).
- `.github/actions/setup` is the shared toolchain setup for workflows.

## Conventions

- Conventional Commits (`feat(core): ...`). One unified SemVer version for all packages.
- Actions pinned to full SHAs with a version comment; `permissions: {}` at the top; `persist-credentials: false`.
- Exact dependency versions; pnpm refuses versions younger than 7 days.
- Record decisions as ADRs (`docs/decisions/NNNN-title.md`).
- Generated files carry a "generated, do not edit" header.

## Skills

`deq-security`, `deq-release`, `deq-shape-design`, `deq-export`, `deq-icons-fonts`, `deq-ports-cli`, `deq-content`, `deq-i18n`, `deq-brand` in `.claude/skills/`.
