/** Cached SVG rendering of catalog shapes and Studio items. */
import { getShape, renderShapeData, type RenderOptions } from "@0xdolan/deq-core";

const cache = new Map<string, string>();
const MAX = 2000;

/** Render `shape` with `options`, memoised on the inputs. Throws like core's render. */
export function renderCached(shape: string, options: RenderOptions): string {
  const key = `${shape}\u0000${JSON.stringify(options)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const svg = renderShapeData(getShape(shape), options);
  const oldest = cache.keys().next();
  if (cache.size >= MAX && !oldest.done) cache.delete(oldest.value);
  cache.set(key, svg);
  return svg;
}
