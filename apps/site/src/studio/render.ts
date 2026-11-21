/** Cached SVG rendering of catalog shapes, custom shapes and Studio items. */
import { renderShapeData, type RenderOptions, type ShapeData } from "@0xdolan/deq-core";

import { isCustomId } from "./custom.ts";
import { shapeOf } from "./shapes.ts";

const cache = new Map<string, string>();
const MAX = 2000;

/** FNV-1a, so an edited custom shape never reuses a stale cache entry. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Render shape data with `options`, memoised on the inputs. Throws like core's render. */
export function renderShape(shape: ShapeData, options: RenderOptions): string {
  const content = isCustomId(shape.id) ? `#${hash(JSON.stringify(shape.primitives))}` : "";
  const key = `${shape.id}${content}\u0000${JSON.stringify(options)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const svg = renderShapeData(shape, options);
  const oldest = cache.keys().next();
  if (cache.size >= MAX && !oldest.done) cache.delete(oldest.value);
  cache.set(key, svg);
  return svg;
}

/** Render the catalog or custom shape `shape` with `options`. */
export function renderCached(shape: string, options: RenderOptions): string {
  return renderShape(shapeOf(shape), options);
}
