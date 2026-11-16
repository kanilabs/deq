# @0xdolan/deq-exporters

Export Deq shapes, the parametric design system of traditional Kurdish tattoo motifs, to 23 formats from one call: SVG, layered SVG, sprites, HTML, React, Vue and Svelte components, data URIs and CSS, PDF, AI, EPS, PNG, JPG, WebP, AVIF, ICO, a favicon pack, PSD, Figma SVG and spec JSON. Named layers are kept wherever the format has them.

It runs in Node and in browsers, with no DOM and no native modules. Raster formats use WASM (resvg and the jSquash codecs).

```ts
import { exportShapes } from "@0xdolan/deq-exporters";

const [pdf] = await exportShapes("pdf", ["kurdish-sun"], { render: { color: "#ED2024" } });
// pdf.name === "kurdish-sun.pdf", pdf.mediaType === "application/pdf", pdf.data: Uint8Array

const pngs = await exportShapes(
  "png",
  ["roj-half-sun", { shape: "chevron", name: "arrow", options: { color: "teal" } }],
  { render: { size: 64 }, scales: [1, 2] },
);
// roj-half-sun.png, roj-half-sun@2x.png, arrow.png, arrow@2x.png

await exportShapes("tsx", [{ shape: "roj-half-sun", params: { rays: 9 } }]); // RojHalfSun.tsx
await exportShapes("svg-layered", [
  { parts: [{ shape: "kurdish-sun" }, { shape: "comb", layer: "comb" }] },
]);
await exportShapes("favicon", ["kurdish-sun"], {
  favicon: { name: "My site", darkColor: "#FEBD11" },
});
```

## Items

An item is a catalog id, `{ shape, name?, params?, options? }`, or a composition `{ parts, name? }` (parts as in core's `compose`). `name` (kebab case) sets the file name and defaults to the shape id. Up to 512 items per call. Item options win over `options.render`.

## Formats

| Format           | Output                                | Layers                                 |
| ---------------- | ------------------------------------- | -------------------------------------- |
| `svg`            | `name.svg`, core's minimal SVG        | `data-layer` groups with `layerColors` |
| `svg-layered`    | `name.svg`                            | Inkscape layers                        |
| `svg-sprite`     | `deq-sprite.svg`, one `<symbol>` each |                                        |
| `html`           | `name.html`, inline SVG snippet       |                                        |
| `jsx`, `tsx`     | `Name.jsx`, `Name.tsx` (React)        |                                        |
| `vue`            | `Name.vue` (single-file component)    |                                        |
| `svelte`         | `Name.svelte` (Svelte 5)              |                                        |
| `data-uri`       | `name.txt`                            |                                        |
| `css-background` | `deq-background.css`                  |                                        |
| `css-mask`       | `deq-mask.css` (takes `currentColor`) |                                        |
| `pdf`            | `name.pdf`                            | Optional Content Groups                |
| `ai`             | `name.ai` (PDF-compatible)            | Optional Content Groups                |
| `eps`            | `name.eps` (EPSF-3.0)                 | `% layer:` comments only               |
| `png`            | `name.png`, `name@2x.png`, …          |                                        |
| `jpg`            | `name.jpg`, …                         |                                        |
| `webp`, `avif`   | `name.webp`, `name.avif`, …           |                                        |
| `ico`            | `name.ico` (PNG entries)              |                                        |
| `favicon`        | 7 files, one item only (see below)    |                                        |
| `psd`            | `name.psd`, `name@2x.psd`, …          | Pixel layers, plus `background`        |
| `figma`          | `name.figma.svg`, concrete colours    | Named groups                           |
| `spec-json`      | `name.json`, re-importable shape      | Kept                                   |

The favicon pack is `favicon.ico` (16, 32, 48), `favicon.svg` (follows the browser's dark mode), `apple-touch-icon.png` (180, opaque), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (80% safe zone) and `site.webmanifest`.

## Options

| Option         | Default      | Used by                                                               |
| -------------- | ------------ | --------------------------------------------------------------------- |
| `render`       | `{}`         | all: core render options for every item                               |
| `currentColor` | `#000000`    | PDF, AI, EPS, raster, ICO, PSD, Figma                                 |
| `scales`       | `[1]`        | raster and PSD: integers 1 to 8, unique                               |
| `quality`      | 90 (AVIF 70) | JPG, WebP, AVIF: 0 to 100                                             |
| `matte`        | `#ffffff`    | JPG: colour behind transparent pixels                                 |
| `colorSpace`   | `rgb`        | PDF, AI, EPS: `rgb` or `cmyk` (naive conversion)                      |
| `layers`       | `true`       | PDF, AI: one Optional Content Group per layer                         |
| `prefix`       | `deq-`       | sprite symbol ids                                                     |
| `base64`       | `false`      | data URI encoding                                                     |
| `icoSizes`     | 16, 32, 48   | ICO                                                                   |
| `favicon`      | `{}`         | `name`, `shortName`, `color`, `darkColor`, `background`, `themeColor` |

Invalid options throw a `DeqError` with code `INVALID_OPTIONS`; unknown shapes throw `UNKNOWN_SHAPE`. Raster images are at most 8192 px wide.

## Browsers

Node loads the WASM files itself. In a browser, pass the resvg module once before the first raster, ICO, favicon or PSD export (the jSquash codecs find their files through `import.meta.url`):

```ts
import { initRaster } from "@0xdolan/deq-exporters";

await initRaster({ resvg: new URL("@resvg/resvg-wasm/index_bg.wasm", import.meta.url) });
```

`copyToClipboard(svg)` copies markup for pasting into Figma, Illustrator or Inkscape.

## Opening the layered files

Inkscape 1.4 and later show the layers of `svg-layered`, `pdf` and `ai` files; CI checks this automatically. Illustrator and Photoshop are checked by hand:

- **Illustrator**: open `name.ai` or `name.pdf`. The Layers panel lists one layer per shape layer (and `background` when the shape has one), in the shape's order.
- **Photoshop**: open `name.psd`. The Layers panel lists one pixel layer per shape layer, plus `background`; turning layers off matches the composite.
- **Adobe XD**: import `name.svg` or `name.figma.svg` (File › Import). XD has no layered import.
- **Figma**: paste the `figma` output, or use `copyToClipboard`.

## Limits

- EPS has no transparency: opacity options are ignored there. Use PDF when you need them.
- CMYK is a naive conversion (`K = 1 − max(R, G, B)`), not a colour-managed one.
- PSD and raster outputs are pixel images: export at the size you need with `scales`.

See [ADR 0009](../../docs/decisions/0009-exporters.md) for the design.

License: GPL-3.0-or-later.
