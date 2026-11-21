---
title: Writing an exporter
description: Add an export format to @0xdolan/deq-exporters, with the contract every format follows and the tests it needs.
sidebar:
  order: 8
---

`@0xdolan/deq-exporters` turns shapes into files ([ADR 0009](../decisions/0009-exporters.md), [API reference](../api/exporters.md)). Every format goes through one entry point:

```ts
exportShapes(format, items, options): Promise<ExportFile[]>  // { name, mediaType, data }
```

## Steps

1. Add the format id to `FORMATS` in `packages/exporters/src/index.ts`.
2. Write the writer in a module of its own, or next to similar formats (`svg.ts` for SVG text formats, `components.ts` for framework components, `pdf.ts`, `eps.ts`, `raster.ts`, `psd.ts`, `favicon.ts`, `spec.ts`).
3. Add a `case` to `perItem` in `index.ts`. A format that writes one file for many items (like the sprite, CSS or favicon) is handled in `exportShapes` itself.
4. If it needs new options, add them to `OptionsSchema`, the valibot schema `checkOptions` validates against.
5. Add the format to the `EXPECTED` table in `src/index.test.ts` (file names and media type), to the README table and to the [user guide](../guide/exporting.md).
6. If the format cannot hold a scene (a Leet text or a pattern), add it to `SCENE_UNSUPPORTED` in `src/input.ts` and to `apps/site/src/studio/formats.ts`; a test keeps the two lists equal.
7. If the website should offer it, check `apps/site/src/studio/formats.ts` and the Studio export dialog.

## The contract

- **Build on core.** Never re-implement expansion or option handling. Start from core's `prepare()` (validated options and flat geometry) and `svgDocument()`. Vector writers go through `buildDrawing()` in `src/drawing.ts`, which follows core's paint rules.
- **Validate options** with valibot `strictObject`s. Every failure is a `DeqError` (`INVALID_OPTIONS` and so on). Parse colours with `parseColor` and write them back with `toHex`, never as given.
- **Be deterministic.** No dates, random ids or anything from the environment in the output.
- **Write nothing active.** No scripts, `href`s or external references. Escape strings for their context: XML, JavaScript, PDF UTF-16BE, ASCII-only EPS comments.
- **Keep the limits:** 512 items, raster width up to 8192 px, scales from 1 to 8. File names must be unique even when case is ignored.
- **Keep the layers** where the format has them: one group, OCG or pixel layer per shape layer, with `background` first.
- **Browsers:** raster formats need `initRaster({ resvg })` first, and the page's CSP needs `'wasm-unsafe-eval'`.

Items can be a catalog id, a shape with options, a composition, a shape spec as data (`DataItem`), or a scene (`LeetItem`, `PatternItem`, `SceneItem`). Read `src/input.ts` for how each one is checked.

## Tests

Every format needs a round trip: read the file back and compare it with core's output.

| Kind        | How it is checked                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Components  | Compile with TypeScript, `@vue/compiler-sfc` or `svelte/compiler`, render and compare with core |
| Raster      | Decode the file and compare pixels with `rasterize`                                             |
| PDF and EPS | Render with Ghostscript and compare with resvg (`test/tools.ts`)                                |
| Layers      | Inkscape must list the layer names of layered SVG, PDF and AI; PSD is read back with `ag-psd`   |
| Spec JSON   | Validate against `spec/schema/shape.schema.json`; `renderShapeData` must equal `render`         |

Tests that need Ghostscript or Inkscape 1.4+ are skipped when the tools are missing. `just test-tools` and the `exporter-tools` CI job run them with `DEQ_REQUIRE_TOOLS=1`, which fails instead of skipping. Illustrator and Photoshop files are checked by hand.

## Ports

The Python and Rust ports write `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp` and `ico`, and exit with code 4 for other formats. A change to one of these formats lands in the ports in the same pull request, and SVG and PDF must stay byte-identical ([ADR 0011](../decisions/0011-ports-and-clis.md)).
