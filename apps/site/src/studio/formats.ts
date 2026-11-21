/**
 * Export format lists, kept free of runtime imports so the Leet and pattern pages can show
 * their export form without loading `@0xdolan/deq-exporters` until a download starts.
 */
import type { ExportFormat } from "@0xdolan/deq-exporters";

/** Formats grouped for the export dialog. */
export const FORMAT_GROUPS: readonly { id: string; formats: readonly ExportFormat[] }[] = [
  { id: "vector", formats: ["svg", "svg-layered", "svg-sprite", "pdf", "ai", "eps"] },
  { id: "raster", formats: ["png", "jpg", "webp", "avif", "ico", "favicon", "psd"] },
  {
    id: "code",
    formats: ["html", "jsx", "tsx", "vue", "svelte", "data-uri", "css-background", "css-mask"],
  },
  { id: "data", formats: ["figma", "spec-json"] },
];

/** Formats drawn by the WebAssembly rasteriser (see `runExport`'s `prepare` in `exporting.ts`). */
export const RASTER: ReadonlySet<ExportFormat> = new Set([
  "png",
  "jpg",
  "webp",
  "avif",
  "ico",
  "favicon",
  "psd",
]);

/** Formats that use the scale factors. */
export const SCALED: ReadonlySet<ExportFormat> = new Set(["png", "jpg", "webp", "avif", "psd"]);

/** Formats that take a whole scene; the exporters refuse the rest (`SCENE_UNSUPPORTED`). */
const NOT_FOR_SCENES: ReadonlySet<ExportFormat> = new Set([
  "svg-sprite",
  "ico",
  "favicon",
  "figma",
  "spec-json",
]);

/** {@link FORMAT_GROUPS} without the formats that cannot take a scene. */
export const SCENE_FORMAT_GROUPS = FORMAT_GROUPS.map((g) => ({
  ...g,
  formats: g.formats.filter((f) => !NOT_FOR_SCENES.has(f)),
})).filter((g) => g.formats.length > 0);
