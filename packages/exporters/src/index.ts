/**
 * @0xdolan/deq-exporters: export Deq shapes to SVG, PDF, AI, EPS, PSD, PNG, JPG, WebP,
 * AVIF, ICO, a favicon pack, React, Vue, Svelte, CSS, Figma and spec JSON.
 *
 * Every format goes through {@link exportShapes}; the per-format functions are exported
 * too for callers that want one string or byte array.
 */
import { DeqError } from "@0xdolan/deq-core";
import type { RenderOptions } from "@0xdolan/deq-core";
import * as v from "valibot";

import { parseColor } from "./color.js";
import { componentName, toReact, toSvelte, toVue } from "./components.js";
import { buildDrawing } from "./drawing.js";
import { writeEps } from "./eps.js";
import { ICO_SIZES, toFaviconPack, toIco } from "./favicon.js";
import type { FaviconOptions } from "./favicon.js";
import { SCENE_UNSUPPORTED, canvasPixels, resolveItems } from "./input.js";
import type { ExportFile, ExportItem, Resolved } from "./input.js";
import { writePdf } from "./pdf.js";
import type { ColorSpace } from "./pdf.js";
import { writePsd } from "./psd.js";
import { MAX_RASTER, encodeSvg } from "./raster.js";
import type { RasterFormat } from "./raster.js";
import { toSpecJson } from "./spec.js";
import {
  svgDataUri,
  toCssBackground,
  toCssMask,
  toFigmaSvg,
  toHtml,
  toLayeredSvg,
  toSprite,
  toSvg,
} from "./svg.js";

/** Every export format. */
export const FORMATS = [
  "svg",
  "svg-layered",
  "svg-sprite",
  "html",
  "jsx",
  "tsx",
  "vue",
  "svelte",
  "data-uri",
  "css-background",
  "css-mask",
  "pdf",
  "ai",
  "eps",
  "png",
  "jpg",
  "webp",
  "avif",
  "ico",
  "favicon",
  "psd",
  "figma",
  "spec-json",
] as const;

export type ExportFormat = (typeof FORMATS)[number];

/** Options for {@link exportShapes}. Options a format does not use are ignored. */
export interface ExportOptions {
  /** Render options for every item (an item's own `options` win). */
  readonly render?: RenderOptions;
  /** What `currentColor` means where nothing inherits it (PDF, AI, EPS, raster, PSD, Figma). Default black. */
  readonly currentColor?: string;
  /** Raster and PSD scale factors: 1 gives `size` px, 2 gives `name@2x.png`. Default `[1]`. */
  readonly scales?: readonly number[];
  /** JPG, WebP and AVIF quality, 0 to 100. */
  readonly quality?: number;
  /** JPG background for transparent pixels. Default white. */
  readonly matte?: string;
  /** PDF, AI and EPS colour space. Default `rgb`. */
  readonly colorSpace?: ColorSpace;
  /** PDF and AI: one Optional Content Group per layer. Default true. */
  readonly layers?: boolean;
  /** Sprite symbol id prefix. Default `deq-`. */
  readonly prefix?: string;
  /** Data URIs: base64 instead of percent encoding. Default false. */
  readonly base64?: boolean;
  /** ICO sizes. Default 16, 32 and 48. */
  readonly icoSizes?: readonly number[];
  /** Favicon pack options (one item only). */
  readonly favicon?: FaviconOptions;
}

const Color = v.pipe(v.string(), v.maxLength(64));
const OptionsSchema = v.strictObject({
  render: v.optional(v.record(v.string(), v.unknown())),
  currentColor: v.optional(Color),
  scales: v.optional(
    v.pipe(
      v.array(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8))),
      v.minLength(1),
      v.maxLength(8),
      v.check((a) => new Set(a).size === a.length, "scales must be unique"),
    ),
  ),
  quality: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100))),
  matte: v.optional(Color),
  colorSpace: v.optional(v.picklist(["rgb", "cmyk"])),
  layers: v.optional(v.boolean()),
  prefix: v.optional(v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,31}$/))),
  base64: v.optional(v.boolean()),
  icoSizes: v.optional(
    v.pipe(
      v.array(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(256))),
      v.minLength(1),
      v.maxLength(8),
    ),
  ),
  favicon: v.optional(
    v.strictObject({
      name: v.optional(v.pipe(v.string(), v.maxLength(64))),
      shortName: v.optional(v.pipe(v.string(), v.maxLength(32))),
      color: v.optional(Color),
      darkColor: v.optional(Color),
      background: v.optional(Color),
      themeColor: v.optional(Color),
    }),
  ),
});

function invalid(issues: string[]): never {
  throw new DeqError("INVALID_OPTIONS", `invalid export options: ${issues.join("; ")}`, issues);
}

function checkOptions(format: string, options: unknown): void {
  if (!(FORMATS as readonly string[]).includes(format)) {
    invalid([
      `format: must be one of ${FORMATS.join(", ")} (got ${JSON.stringify(format.slice(0, 40))})`,
    ]);
  }
  const result = v.safeParse(OptionsSchema, options);
  if (!result.success) {
    invalid(
      result.issues.map((i) => {
        const path = i.path?.map((p) => String(p.key)).join(".") ?? "options";
        return `${path}: ${i.message}`;
      }),
    );
  }
}

const text = (name: string, mediaType: string, data: string): ExportFile => ({
  name,
  mediaType,
  data,
});
const bin = (name: string, mediaType: string, data: Uint8Array): ExportFile => ({
  name,
  mediaType,
  data,
});

const RASTER_TYPES: Record<RasterFormat, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
};

const suffix = (scale: number): string => (scale === 1 ? "" : `@${String(scale)}x`);

/** The raster width at `scale`; both sides of a wide or tall scene must fit. */
function pixelWidth(r: Resolved, scale: number): number {
  const px = canvasPixels(r.prepared);
  const width = Math.round(px.width * scale);
  const longest = Math.max(width, Math.round(px.height * scale));
  if (longest > MAX_RASTER) {
    invalid([
      `scales: ${r.name} at ${String(scale)}x is ${String(longest)} px, more than ${String(MAX_RASTER)}`,
    ]);
  }
  return width;
}

/** SVG with `currentColor` resolved, for renderers that have no CSS context. */
function concreteSvg(r: Resolved, current: string): string {
  return toFigmaSvg(r, parseColor(current));
}

async function perItem(format: ExportFormat, r: Resolved, o: ExportOptions): Promise<ExportFile[]> {
  const current = o.currentColor ?? "#000000";
  const scales = o.scales ?? [1];
  switch (format) {
    case "svg":
      return [text(`${r.name}.svg`, "image/svg+xml", `${toSvg(r)}\n`)];
    case "svg-layered":
      return [text(`${r.name}.svg`, "image/svg+xml", `${toLayeredSvg(r)}\n`)];
    case "html":
      return [text(`${r.name}.html`, "text/html", toHtml(r))];
    case "jsx":
      return [text(`${componentName(r.name)}.jsx`, "text/jsx", toReact(r, false))];
    case "tsx":
      return [text(`${componentName(r.name)}.tsx`, "text/tsx", toReact(r, true))];
    case "vue":
      return [text(`${componentName(r.name)}.vue`, "text/x-vue", toVue(r))];
    case "svelte":
      return [text(`${componentName(r.name)}.svelte`, "text/x-svelte", toSvelte(r))];
    case "data-uri":
      return [text(`${r.name}.txt`, "text/plain", `${svgDataUri(toSvg(r), o.base64 ?? false)}\n`)];
    case "pdf":
    case "ai": {
      const pdf = writePdf(buildDrawing(r.prepared, parseColor(current)), {
        ...(o.colorSpace ? { colorSpace: o.colorSpace } : {}),
        ...(o.layers === undefined ? {} : { layers: o.layers }),
      });
      return [
        format === "pdf"
          ? bin(`${r.name}.pdf`, "application/pdf", pdf)
          : bin(`${r.name}.ai`, "application/postscript", pdf),
      ];
    }
    case "eps":
      return [
        text(
          `${r.name}.eps`,
          "application/postscript",
          writeEps(
            buildDrawing(r.prepared, parseColor(current)),
            o.colorSpace ? { colorSpace: o.colorSpace } : {},
          ),
        ),
      ];
    case "png":
    case "jpg":
    case "webp":
    case "avif": {
      const svg = concreteSvg(r, current);
      const matte = parseColor(o.matte ?? "#ffffff");
      return Promise.all(
        scales.map(async (scale) =>
          bin(
            `${r.name}${suffix(scale)}.${format}`,
            RASTER_TYPES[format],
            await encodeSvg(svg, pixelWidth(r, scale), format, {
              ...(o.quality === undefined ? {} : { quality: o.quality }),
              matte,
            }),
          ),
        ),
      );
    }
    case "ico":
      return [
        bin(`${r.name}.ico`, "image/vnd.microsoft.icon", await toIco(r, o.icoSizes ?? ICO_SIZES)),
      ];
    case "psd":
      return Promise.all(
        scales.map(async (scale) =>
          bin(
            `${r.name}${suffix(scale)}.psd`,
            "image/vnd.adobe.photoshop",
            await writePsd(withConcreteColor(r, current), pixelWidth(r, scale)),
          ),
        ),
      );
    case "figma":
      return [text(`${r.name}.figma.svg`, "image/svg+xml", `${concreteSvg(r, current)}\n`)];
    case "spec-json":
      return [text(`${r.name}.json`, "application/json", toSpecJson(r))];
    default:
      // Multi-item formats are handled by exportShapes.
      return [];
  }
}

/** Prepared geometry whose `currentColor` root colour is replaced by a concrete one. */
function withConcreteColor(r: Resolved, current: string): Resolved["prepared"] {
  const o = r.prepared.options;
  if (!/^currentcolor$/i.test(o.color)) return r.prepared;
  return { ...r.prepared, options: { ...o, color: current } };
}

/**
 * Export items to a format. Returns one or more files; their names are unique and never
 * contain a path.
 *
 * @example
 * const [pdf] = await exportShapes("pdf", ["kurdish-sun"], { render: { color: "#c00" } });
 *
 * @throws {DeqError} `INVALID_OPTIONS`, `UNKNOWN_SHAPE`, `INVALID_PARAMETER` or `LIMIT_EXCEEDED`.
 */
export async function exportShapes(
  format: ExportFormat,
  items: readonly ExportItem[],
  options: ExportOptions = {},
): Promise<ExportFile[]> {
  checkOptions(format, options);
  if (options.currentColor !== undefined) parseColor(options.currentColor);
  if (options.matte !== undefined) parseColor(options.matte);
  const resolved = resolveItems(items, options.render ?? {});
  const scene = resolved.find((r) => r.scene !== undefined);
  if (scene && (SCENE_UNSUPPORTED as readonly string[]).includes(format)) {
    invalid([`items: ${scene.name} is a scene; ${format} takes single shapes only`]);
  }
  let files: ExportFile[];
  switch (format) {
    case "svg-sprite":
      files = [
        text("deq-sprite.svg", "image/svg+xml", toSprite(resolved, options.prefix ?? "deq-")),
      ];
      break;
    case "css-background":
      files = [
        text("deq-background.css", "text/css", resolved.map((r) => toCssBackground(r)).join("\n")),
      ];
      break;
    case "css-mask":
      files = [text("deq-mask.css", "text/css", resolved.map((r) => toCssMask(r)).join("\n"))];
      break;
    case "favicon": {
      const [only] = resolved;
      if (!only || resolved.length > 1) invalid(["items: the favicon pack takes exactly one item"]);
      files = await toFaviconPack(only, options.favicon ?? {});
      break;
    }
    default:
      files = (await Promise.all(resolved.map((r) => perItem(format, r, options)))).flat();
  }
  // Case-insensitive file systems: two names may differ only by case (RojA vs Roja).
  const seen = new Set<string>();
  for (const f of files) {
    const key = f.name.toLowerCase();
    if (seen.has(key)) invalid([`items: two items export to the same file name ${f.name}`]);
    seen.add(key);
  }
  return files;
}

export { BLACK, parseColor, toCmyk, toHex } from "./color.js";
export type { Rgba } from "./color.js";
export { componentName, toReact, toSvelte, toVue } from "./components.js";
export { buildDrawing } from "./drawing.js";
export type { DrawOp, Drawing, Matrix, PathCmd } from "./drawing.js";
export { writeEps } from "./eps.js";
export type { EpsOptions } from "./eps.js";
export { ICO_SIZES, packIco, toFaviconPack, toIco } from "./favicon.js";
export type { FaviconOptions } from "./favicon.js";
export { MAX_ITEMS, SCENE_UNSUPPORTED, canvasPixels, resolveItem, resolveItems } from "./input.js";
export type {
  CompositionItem,
  DataItem,
  ExportFile,
  ExportItem,
  LeetItem,
  PatternItem,
  Resolved,
  SceneItem,
  ShapeItem,
} from "./input.js";
export { writePdf } from "./pdf.js";
export type { ColorSpace, PdfOptions } from "./pdf.js";
export { writePsd } from "./psd.js";
export { MAX_RASTER, encodeSvg, initRaster, rasterize } from "./raster.js";
export type { Bitmap, EncodeOptions, RasterFormat, RasterWasm } from "./raster.js";
export { toSpecJson, toSpecShape } from "./spec.js";
export {
  copyToClipboard,
  cssClass,
  splitSvg,
  svgDataUri,
  toCssBackground,
  toCssMask,
  toDataUri,
  toFigmaSvg,
  toHtml,
  toLayeredSvg,
  toSprite,
  toSvg,
} from "./svg.js";
export type { SvgParts } from "./svg.js";

/** The package name. */
export const packageName = "@0xdolan/deq-exporters" as const;
