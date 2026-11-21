/**
 * Photoshop documents (ag-psd): one named pixel layer per shape layer, plus a background
 * layer when the shape has a background, and a flattened composite.
 */
import { svgDocument } from "@0xdolan/deq-core";
import type { Prepared } from "@0xdolan/deq-core";
import { writePsdUint8Array } from "ag-psd";
import type { Layer } from "ag-psd";

import { rasterize } from "./raster.js";

/**
 * Write a PSD at `width` pixels. Each layer is rendered on its own, so overlaps between
 * layers blend in Photoshop exactly as in the composite (normal blending).
 */
export async function writePsd(p: Prepared, width: number): Promise<Uint8Array> {
  const used = p.layers.filter((l) => p.items.some((i) => i.layer === l));
  const noBackground = { ...p.options, background: "none" };
  const children: Layer[] = [];
  if (p.options.background !== "none") {
    const bg = await rasterize(svgDocument({ ...p, items: [] }), width);
    children.push({ name: "background", top: 0, left: 0, imageData: bg });
  }
  for (const layer of used) {
    const only: Prepared = {
      ...p,
      options: noBackground,
      items: p.items.filter((i) => i.layer === layer),
    };
    const img = await rasterize(svgDocument(only), width);
    children.push({ name: layer, top: 0, left: 0, imageData: img });
  }
  const composite = await rasterize(svgDocument(p), width);
  return writePsdUint8Array(
    { width: composite.width, height: composite.height, imageData: composite, children },
    { generateThumbnail: false },
  );
}
