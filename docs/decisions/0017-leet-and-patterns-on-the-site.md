# 17. Leet and patterns on the site and in the Studio

- Status: accepted
- Date: 2026-11-19

## Context

Phase 9d puts Deq Leet and the pattern generator (ADR 0015) in front of people: a `/leet` page, a `/generate` page and two Studio tabs. People must be able to export a scene in any sensible format with one layer per character, copy text for the Deq Leet font (ADR 0016), read basic Leet back, frame text with motifs, and edit inserted text in the Studio like any other design.

## Decision

- **Shared panels.** `LeetPanel.svelte` and `GeneratePanel.svelte` in `apps/site/src/studio/components/` run in two modes. `page` previews, copies and exports. `studio` inserts into the design. The pages mount them with `client:only="svelte"` and the Studio messages, so pages and tabs share one set of strings (`studio.leet.*`, `studio.gen.*`, `studio.scene.*`). Style controls (`SceneStyle.svelte`) and the export form (`SceneExport.svelte`) are shared too.
- **Pure logic in `generate.ts`.** `composeLeet` places Leet text inside an optional frame: bands from `pattern({kind: "band"})` above and below, or a `border` sized to the text (at most 32 cells a side), 6 units from the text. `puaText` turns cells into the font's PUA code points by matching each cell's glyph with the basic, advanced or full entry in `fonts/leet-codepoints.json`. PUA characters are left to right, so Sorani lines are written in visual order. `insertScene` turns a scene into Studio items. Everything is unit-tested with happy-dom.
- **Site-only extras.** Frames, line guides and the PUA text are features of the site. The generator, the ports, the CLIs and the golden fixtures are unchanged. The generator gains only `prepareScene`, so the exporters can draw a scene, and core's `Prepared` gains its `width` and `height`.
- **Scene export.** `@0xdolan/deq-exporters` accepts `LeetItem`, `PatternItem` and `SceneItem` (a caller's scene, validated against a strict schema and core's limits). Layered SVG, PDF, AI and PSD get one layer per cell. Rasters keep the aspect ratio within 8192 × 8192 px. `svg-sprite`, `ico`, `favicon`, `figma` and `spec-json` need one square shape and refuse scenes (`SCENE_UNSUPPORTED`). The pages hide those formats (`SCENE_FORMAT_GROUPS` in `formats.ts`, tested against the exporters' list).
- **Editable groups in the Studio.** An inserted scene is one undo step. It becomes one group (when it has two or more cells) with an item per cell, selected and centred in the view. A glyph of one part becomes a catalog item at size × scale with its rotation and parameters. Its stroke width and dot scale are divided by the part's scale, because core never scales strokes inside `use`. A glyph of several parts becomes a custom shape of `use` primitives, embedded in `doc.shapes` and deduplicated. Inserts respect the item limit (500) and the custom shape limit (100).
- **Light pages.** The export form loads `exporting.ts` and the exporters on the first download, so the pages ship the generator and core only. The panel placeholder is as tall as the viewport, so mounting the panel moves no content into view.
- **Security.** Leet input is plain text in a `<textarea>`, capped at the generator's limits. Previews go through `svg.ts` like every Studio SVG. Decoding reads at most `MAX_DECODE_INPUT` bytes from a file or paste. The pages compile the rasteriser's WebAssembly, so the CSP integration adds `'wasm-unsafe-eval'` to `studio`, `leet` and `generate` pages in each locale only, matched against the path inside the build folder.

## Consequences

- New Leet or pattern options appear in the panels, the i18n catalogs (en, ckb, kmr) and the user guides (`docs/leet`, `docs/generate`).
- A new exporter format must be added to `formats.ts`, and to `SCENE_UNSUPPORTED` if it cannot take a scene.
- The pages are checked by `e2e/leet.spec.ts` on desktop and on a phone (axe, CSP, export, decode, Studio inserts) and by Lighthouse.
