---
name: deq-export
description: Export formats and the exporter contract for Deq shapes (SVG, layered SVG, PDF, AI, PSD, PNG, ICO, JSX, Figma). Use when adding or changing an exporter.
---

# Deq exporters

`@0xdolan/deq-exporters` (Phase 4, ADR 0009). API and formats: `packages/exporters/README.md`.

## Contract

- One entry point: `exportShapes(format, items, options) → ExportFile[]` (`name`, `mediaType`, `data`). Add a format to `FORMATS` in `src/index.ts`, to the `EXPECTED` table in `src/index.test.ts` and to the README table.
- Never re-implement expansion or option handling: build from core's `prepare()` (validated `Prepared`) and `svgDocument()`. Vector writers go through `buildDrawing()` in `src/drawing.ts`, which mirrors core's paint rules.
- Options are a valibot `strictObject`; every failure is a `DeqError` (`INVALID_OPTIONS` and so on). Validate colours with `parseColor` and re-serialise them (`toHex`) before writing them into a file.
- Output is deterministic (no dates, random ids or environment data) and contains no scripts, `href`s or external references. Strings in code are escaped for their context (XML, JS, PDF UTF-16BE, ASCII-only EPS comments).
- File names are unique without case; a format that writes one file for many items (sprite, CSS, favicon) handles that in `exportShapes`.
- Limits: 512 items, raster width 8192 px, scales 1 to 8.
- Keep layers: layered SVG (Inkscape attributes), PDF/AI (one OCG per layer, `background` first), PSD (one pixel layer per used layer), Figma (named groups), spec JSON.

## Modules

`input.ts` (items), `svg.ts` (SVG text formats, Figma, clipboard), `components.ts` (React, Vue, Svelte), `color.ts` + `named-colors.ts` (CSS Color 4 parser, naive CMYK), `drawing.ts`, `pdf.ts`, `eps.ts`, `raster.ts` (resvg + jSquash WASM, `initRaster` for browsers), `psd.ts` (ag-psd), `favicon.ts` (ICO, pack), `spec.ts`.

## Tests (every format needs a round trip)

- Components: transpile or compile (TypeScript, `@vue/compiler-sfc`, `svelte/compiler`) and compare with core.
- Raster: decode (jSquash decoders, PNG through resvg) and compare pixels with `rasterize`.
- PDF and EPS: render with Ghostscript and compare with resvg (`test/tools.ts`: `gsRender`, `meanDiff`, `inkDiff` for CMYK).
- Layers: Inkscape import of layered SVG, PDF and AI must list the layer names; PSD via `ag-psd` `readPsd`.
- Spec JSON: Ajv 2020 against `spec/schema/shape.schema.json` `$defs`, and `renderShapeData` must equal `render`.
- Ghostscript and Inkscape tests skip when the tools are missing; `just test-tools` and the `exporter-tools` CI job set `DEQ_REQUIRE_TOOLS=1` (Inkscape 1.4+ needed for PDF layers).
- After changing core, run `pnpm --filter @0xdolan/deq-core build`: Vitest resolves core from `dist`.
- Illustrator and Photoshop are checked by hand by the owner (README "Opening the layered files").
