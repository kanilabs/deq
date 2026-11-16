# 9. Exporters

- Status: accepted
- Date: 2026-11-16

## Context

Phase 4 builds `@0xdolan/deq-exporters`: every format in PRD §8.6 from one call, with named layers kept where the format has them. The PRD suggested pdf-lib and svg2pdf.js for PDF. Those libraries need a DOM (svg2pdf.js) or a large general-purpose writer (pdf-lib), and neither writes EPS. The layered files must open with their layers in Inkscape, Illustrator and Photoshop, and that must be checked automatically where possible.

## Decision

- **One entry point.** `exportShapes(format, items, options)` returns `ExportFile[]` (`name`, `mediaType`, `data`). Items are catalog ids, `{ shape, name?, params?, options? }` or compositions `{ parts, name? }`, at most 512 per call. Options are a valibot strict object; anything unknown is an `INVALID_OPTIONS` `DeqError`. File names are unique, compared without case, so archives work on case-insensitive file systems.
- **Geometry comes from core.** Core now exports `prepare` (validated options plus flat, layered geometry) and `svgDocument`, so exporters never re-implement expansion or option handling. Vector writers read the same `Prepared` value through `buildDrawing`, which mirrors core's paint rules (fill only on closed outlines, dots filled, layer colours, opacities, absolute stroke width, rotation and flips).
- **Own PDF and EPS writer** (deviation from the PRD). About 250 lines (plus the shared `drawing.ts`) turn a `Drawing` into a PDF 1.7 file or an EPSF-3.0 file:
  - one Optional Content Group per layer, listed in `/OCProperties` with `/PageMode /UseOC`, so viewers show a layers panel;
  - RGB or naive CMYK (`K = 1 − max(R, G, B)`); exact ICC conversion is left to print tools;
  - opacity through `ExtGState` (`/CA`, `/ca`); EPS has no transparency, so opacity is dropped there and the README says so;
  - deterministic output: no dates, no IDs, fixed number formatting.

  AI is the same PDF with an `.ai` name and `application/postscript` type. Illustrator opens PDF-compatible AI files and shows OCGs as layers.

- **Raster through WASM.** resvg (`@resvg/resvg-wasm` 2.6.2) renders the SVG; PNG comes from resvg, JPG, WebP and AVIF from the jSquash codecs (mozjpeg, libwebp, libavif). They run in Node and in browsers without native modules. Node loads the packaged WASM files; browsers call `initRaster({ resvg })` first. Widths are capped at 8192 px. PSD uses ag-psd: one pixel layer per shape layer, a background layer when there is one, and the flattened composite.
- **Text formats reuse core's SVG.** Layered SVG adds Inkscape layer attributes. Sprite, CSS background and mask, data URI, Figma SVG (concrete colours, named groups), and JSX, TSX, Vue and Svelte components are built from the same markup. Component defaults are escaped for script contexts.
- **Favicon pack**: `favicon.ico` (PNG entries 16, 32, 48), `favicon.svg` that follows `prefers-color-scheme`, Apple touch icon, 192 and 512 icons, a maskable icon with an 80% safe zone and `site.webmanifest`.
- **Figma** gets copy-as-SVG only (`copyToClipboard` plus the `figma` format); a plugin is out of scope. **Adobe XD** imports the plain SVG. Both are documented, not automated.
- **Verification.** Every format has tests. PDF and EPS are rendered with Ghostscript and compared with resvg's render of the SVG. Inkscape 1.4+ imports the layered SVG, PDF and AI, and the tests check the layer names. These tests skip when the tools are missing; the `exporter-tools` CI job installs them in Ubuntu 26.04 (Inkscape 1.4.3) and sets `DEQ_REQUIRE_TOOLS=1`, so a missing tool fails there. Illustrator and Photoshop are checked by hand by the owner, following the package README.

## Consequences

- No DOM and no native modules: the same code runs in Node, the Studio and workers.
- The PDF writer is small and ours to maintain. It supports only what shapes need (paths, strokes, fills, opacity, layers); text and images are out of scope.
- The WASM files add about 10 MB to the installed package; they load lazily, only when a raster format is used.
- CMYK values are naive. Print work that needs a profile should convert in a prepress tool.
