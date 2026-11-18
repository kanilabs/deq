/**
 * Canvas maths: the view (pan and zoom), snapping to the grid and to other items' edges
 * and centres, and ruler ticks.
 */
import type { Box } from "./model.ts";

export interface View {
  /** Canvas coordinate at the top-left of the viewport. */
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export const ZOOM = { min: 0.1, max: 32, step: 1.25 } as const;
/** Spacing of the canvas grid in px. */
export const GRID = 8;

export const clampZoom = (z: number): number => Math.min(ZOOM.max, Math.max(ZOOM.min, z));

/** Zoom to `zoom`, keeping the canvas point under screen point (sx, sy) fixed. */
export function zoomAt(view: View, zoom: number, sx: number, sy: number): View {
  const z = clampZoom(zoom);
  const wx = view.x + sx / view.zoom;
  const wy = view.y + sy / view.zoom;
  return { x: wx - sx / z, y: wy - sy / z, zoom: z };
}

export function toCanvas(view: View, sx: number, sy: number): { x: number; y: number } {
  return { x: view.x + sx / view.zoom, y: view.y + sy / view.zoom };
}

/** A view that fits `box` into a `width` x `height` viewport with `margin` px around it. */
export function fitView(box: Box, width: number, height: number, margin = 48): View {
  const zoom = clampZoom(
    Math.min((width - 2 * margin) / Math.max(box.w, 1), (height - 2 * margin) / Math.max(box.h, 1)),
  );
  return {
    x: box.x + box.w / 2 - width / 2 / zoom,
    y: box.y + box.h / 2 - height / 2 / zoom,
    zoom,
  };
}

/** The box around several boxes, or undefined for none. */
export function unionBox(boxes: readonly Box[]): Box | undefined {
  if (boxes.length === 0) return undefined;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const bt = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bt - y };
}

export interface SnapResult {
  readonly x: number;
  readonly y: number;
  /** Guide lines to draw: vertical lines at `x` values, horizontal at `y` values. */
  readonly guides: { readonly v: readonly number[]; readonly h: readonly number[] };
}

/**
 * Snap a moving box to other boxes (edges and centres) and, failing that, to the grid.
 * `threshold` is in canvas px.
 */
export function snapBox(
  moving: Box,
  others: readonly Box[],
  threshold: number,
  grid = GRID,
): SnapResult {
  const axis = (pos: number, len: number, targets: number[]) => {
    const anchors = [0, len / 2, len];
    let best: { delta: number; line: number } | undefined;
    for (const a of anchors) {
      for (const t of targets) {
        const delta = t - (pos + a);
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta)))
          best = { delta, line: t };
      }
    }
    if (best) return { pos: pos + best.delta, line: best.line as number | undefined };
    return { pos: grid > 0 ? Math.round(pos / grid) * grid : pos, line: undefined };
  };
  const xs = others.flatMap((b) => [b.x, b.x + b.w / 2, b.x + b.w]);
  const ys = others.flatMap((b) => [b.y, b.y + b.h / 2, b.y + b.h]);
  const sx = axis(moving.x, moving.w, xs);
  const sy = axis(moving.y, moving.h, ys);
  return {
    x: sx.pos,
    y: sy.pos,
    guides: {
      v: sx.line === undefined ? [] : [sx.line],
      h: sy.line === undefined ? [] : [sy.line],
    },
  };
}

/** A "nice" ruler step (1, 2 or 5 x 10^n canvas px) so labels are at least `minPx` apart. */
export function rulerStep(zoom: number, minPx = 60): number {
  const raw = minPx / zoom;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/** Tick positions (canvas px) from `start` over `length` canvas px. */
export function rulerTicks(start: number, length: number, step: number): number[] {
  const first = Math.ceil(start / step) * step;
  const out: number[] = [];
  for (let t = first; t <= start + length && out.length < 500; t += step) out.push(t);
  return out;
}
