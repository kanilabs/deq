/**
 * Export from the Studio (Phase 8d): every format of `@0xdolan/deq-exporters`, for the
 * selected or all visible shapes. Each canvas item becomes one export item with its own
 * options (positions are not part of a shape), custom shapes go in as shape data, and
 * several output files are packed into one ZIP.
 */
import {
  FORMATS,
  exportShapes,
  type ExportFile,
  type ExportFormat,
  type ExportItem,
  type ExportOptions,
} from "@0xdolan/deq-exporters";

import { isCustomId, toShapeData, type CustomDef } from "./custom.ts";
import { RASTER } from "./formats.ts";
import type { Item } from "./model.ts";
import { zip } from "./zip.ts";

export { FORMATS, type ExportFormat };

export { FORMAT_GROUPS, RASTER, SCALED, SCENE_FORMAT_GROUPS } from "./formats.ts";

/** Kebab-case file name from a label, or `fallback` when nothing usable is left. */
export function slug(label: string, fallback: string): string {
  const s = label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48)
    .replace(/-+$/u, "");
  return s || fallback;
}

/**
 * Export items for canvas items, with unique file names: the item's name, else the shape's
 * (custom shapes use their own name), numbered from the second use on.
 */
export function exportItems(
  items: readonly Item[],
  customDef: (id: string) => CustomDef | undefined,
): ExportItem[] {
  const used = new Map<string, number>();
  return items.map((item) => {
    const def = isCustomId(item.shape) ? customDef(item.shape) : undefined;
    if (isCustomId(item.shape) && !def) throw new Error(`missing custom shape ${item.shape}`);
    const base = slug(item.name ?? def?.name ?? item.shape, def ? "custom-shape" : item.shape);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const name = n === 1 ? base : `${base}-${String(n)}`;
    const options = item.name ? { ...item.options, title: item.name } : item.options;
    return def ? { data: toShapeData(def), options, name } : { shape: item.shape, options, name };
  });
}

/** One download: a single file, or a ZIP of several. */
export interface Download {
  readonly name: string;
  readonly type: string;
  readonly data: string | Uint8Array;
  readonly files: number;
}

/** Pack exporter output for download. */
export async function toDownload(files: readonly ExportFile[], date?: Date): Promise<Download> {
  const [only] = files;
  if (only && files.length === 1) {
    return { name: only.name, type: only.mediaType, data: only.data, files: 1 };
  }
  const data = await zip(files, date);
  return { name: "deq-export.zip", type: "application/zip", data, files: files.length };
}

/**
 * Run an export end to end. `prepare` runs first for raster formats (the browser loads the
 * rasteriser's WebAssembly there). @throws whatever the exporters throw (`DeqError`).
 */
export async function runExport(
  format: ExportFormat,
  items: readonly ExportItem[],
  options: ExportOptions = {},
  prepare?: () => Promise<void>,
): Promise<Download> {
  if (RASTER.has(format)) await prepare?.();
  return toDownload(await exportShapes(format, items, options));
}
