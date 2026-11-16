/**
 * A format-neutral vector drawing built from core's flat geometry, shared by the PDF, AI
 * and EPS writers. It follows the same paint rules as core's SVG output.
 */
import { CANVAS, cosSin } from "@0xdolan/deq-core";
import type { Flat, Prepared, Vec } from "@0xdolan/deq-core";

import { BLACK, parseColor } from "./color.js";
import type { Rgba } from "./color.js";

/** A path command in canvas units. */
export type PathCmd =
  | readonly ["m", number, number]
  | readonly ["l", number, number]
  | readonly ["c", number, number, number, number, number, number]
  | readonly ["h"];

/** One painted path. Colours carry the final alpha (colour alpha × opacity). */
export interface DrawOp {
  readonly path: readonly PathCmd[];
  readonly fill?: Rgba;
  readonly stroke?: Rgba;
}

/** An affine matrix `[a, b, c, d, e, f]` (PDF `cm` and SVG `matrix()` order). */
export type Matrix = readonly [number, number, number, number, number, number];

export interface Drawing {
  /** Page width and height in points (1 px = 0.75 pt). */
  readonly width: number;
  readonly height: number;
  /** Canvas units to page points, with the y axis flipped. */
  readonly base: Matrix;
  /** The rotation/flip transforms, outermost first (as in core's SVG). */
  readonly transforms: readonly Matrix[];
  readonly lineWidth: number;
  readonly linecap: 0 | 1 | 2;
  readonly linejoin: 0 | 1 | 2;
  readonly background?: DrawOp;
  /** Layers in first-use (bottom to top) order. */
  readonly layers: readonly { readonly id: string; readonly ops: readonly DrawOp[] }[];
  readonly title: string;
}

/** Bézier constant for a quarter circle. */
const KAPPA = 0.5522847498307936;

function mapPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** A full ellipse as four cubic Béziers, mapped by `m` from the unit circle. */
function unitCircle(m: Matrix): PathCmd[] {
  const k = KAPPA;
  const P = (x: number, y: number): [number, number] => mapPoint(m, x, y);
  const out: PathCmd[] = [["m", ...P(1, 0)]];
  const quads: [number, number, number, number, number, number][] = [
    [1, k, k, 1, 0, 1],
    [-k, 1, -1, k, -1, 0],
    [-1, -k, -k, -1, 0, -1],
    [k, -1, 1, -k, 1, 0],
  ];
  for (const [x1, y1, x2, y2, x, y] of quads)
    out.push(["c", ...P(x1, y1), ...P(x2, y2), ...P(x, y)]);
  out.push(["h"]);
  return out;
}

const circleMatrix = (cx: number, cy: number, r: number): Matrix => [r, 0, 0, r, cx, cy];

/** An open arc from `start` to `end` degrees (clockwise, y down), in ≤ 90° Béziers. */
function arcPath(cx: number, cy: number, r: number, start: number, end: number): PathCmd[] {
  const n = Math.max(1, Math.ceil((end - start) / 90 - 1e-9));
  const step = (end - start) / n;
  const alpha = (4 / 3) * Math.tan((step * Math.PI) / 720);
  const [c0, s0] = cosSin(start);
  const out: PathCmd[] = [["m", cx + r * c0, cy + r * s0]];
  for (let i = 0; i < n; i++) {
    const [ca, sa] = cosSin(start + i * step);
    const [cb, sb] = cosSin(start + (i + 1) * step);
    out.push([
      "c",
      cx + r * (ca - alpha * sa),
      cy + r * (sa + alpha * ca),
      cx + r * (cb + alpha * sb),
      cy + r * (sb - alpha * cb),
      cx + r * cb,
      cy + r * sb,
    ]);
  }
  return out;
}

function pathCmds(item: Flat, dotScale: number): PathCmd[] {
  switch (item.kind) {
    case "poly": {
      const [first, ...rest] = item.points;
      if (!first) return [];
      const out: PathCmd[] = [
        ["m", first[0], first[1]],
        ...rest.map((p): PathCmd => ["l", p[0], p[1]]),
      ];
      if (item.closed) out.push(["h"]);
      return out;
    }
    case "circle":
      return unitCircle(circleMatrix(item.cx, item.cy, item.dot ? item.r * dotScale : item.r));
    case "arc":
      return item.end - item.start >= 360
        ? unitCircle(circleMatrix(item.cx, item.cy, item.r))
        : arcPath(item.cx, item.cy, item.r, item.start, item.end);
    case "ellipse": {
      const [c, s] = cosSin(item.rotation);
      return unitCircle([c * item.rx, s * item.rx, -s * item.ry, c * item.ry, item.cx, item.cy]);
    }
    case "path": {
      const out: PathCmd[] = [];
      let cur: Vec = [0, 0];
      let startPt: Vec = [0, 0];
      for (const seg of item.segments) {
        switch (seg[0]) {
          case "M":
            out.push(["m", seg[1][0], seg[1][1]]);
            cur = seg[1];
            startPt = seg[1];
            break;
          case "L":
            out.push(["l", seg[1][0], seg[1][1]]);
            cur = seg[1];
            break;
          case "Q": {
            const [q, p] = [seg[1], seg[2]];
            out.push([
              "c",
              cur[0] + (2 / 3) * (q[0] - cur[0]),
              cur[1] + (2 / 3) * (q[1] - cur[1]),
              p[0] + (2 / 3) * (q[0] - p[0]),
              p[1] + (2 / 3) * (q[1] - p[1]),
              p[0],
              p[1],
            ]);
            cur = p;
            break;
          }
          case "C":
            out.push(["c", seg[1][0], seg[1][1], seg[2][0], seg[2][1], seg[3][0], seg[3][1]]);
            cur = seg[3];
            break;
          case "Z":
            out.push(["h"]);
            cur = startPt;
            break;
        }
      }
      return out;
    }
  }
}

/** Same rule as core's SVG output: which items take `options.fill`. */
function isClosed(item: Flat): boolean {
  switch (item.kind) {
    case "poly":
      return item.closed;
    case "circle":
      return !item.dot;
    case "ellipse":
      return true;
    case "arc":
      return item.end - item.start >= 360;
    case "path":
      return item.segments.some((s) => s[0] === "Z");
  }
}

const withAlpha = ([r, g, b, a]: Rgba, opacity: number): Rgba => [r, g, b, a * opacity];

const CAP = { butt: 0, round: 1, square: 2 } as const;
const JOIN = { miter: 0, round: 1, bevel: 2 } as const;

/**
 * Build the drawing for prepared geometry.
 *
 * @param currentColor - What `currentColor` means outside a browser. Default black.
 */
export function buildDrawing(p: Prepared, currentColor: Rgba = BLACK): Drawing {
  const o = p.options;
  const box = CANVAS + 2 * o.padding;
  const width = o.size * 0.75;
  const k = width / box;
  const root = parseColor(o.color, currentColor);
  const layerInk = new Map<string, Rgba>();
  const ink = (layer: string): Rgba => {
    let c = layerInk.get(layer);
    if (!c) {
      const lc = o.layerColors[layer];
      c = lc === undefined ? root : parseColor(lc, root);
      layerInk.set(layer, c);
    }
    return c;
  };

  const layers = new Map<string, DrawOp[]>();
  for (const item of p.items) {
    const path = pathCmds(item, o.dotScale);
    if (path.length === 0) continue;
    const layerColor = ink(item.layer);
    let op: DrawOp;
    if (item.paint === "fill" || (item.kind === "circle" && item.dot)) {
      op = { path, fill: withAlpha(layerColor, o.strokeOpacity) };
    } else if (o.fill !== "none" && isClosed(item)) {
      op = {
        path,
        fill: withAlpha(parseColor(o.fill, layerColor), o.fillOpacity),
        stroke: withAlpha(layerColor, o.strokeOpacity),
      };
    } else {
      op = { path, stroke: withAlpha(layerColor, o.strokeOpacity) };
    }
    const list = layers.get(item.layer) ?? [];
    list.push(op);
    layers.set(item.layer, list);
  }

  const transforms: Matrix[] = [];
  if (o.rotation % 360 !== 0) {
    const [c, s] = cosSin(o.rotation);
    const m = CANVAS / 2;
    transforms.push([c, s, -s, c, m - c * m + s * m, m - s * m - c * m]);
  }
  if (o.flipX || o.flipY) {
    transforms.push([
      o.flipX ? -1 : 1,
      0,
      0,
      o.flipY ? -1 : 1,
      o.flipX ? CANVAS : 0,
      o.flipY ? CANVAS : 0,
    ]);
  }

  const background: DrawOp | undefined =
    o.background === "none"
      ? undefined
      : {
          path: [
            ["m", -o.padding, -o.padding],
            ["l", CANVAS + o.padding, -o.padding],
            ["l", CANVAS + o.padding, CANVAS + o.padding],
            ["l", -o.padding, CANVAS + o.padding],
            ["h"],
          ],
          fill: parseColor(o.background, root),
        };

  return {
    width,
    height: width,
    base: [k, 0, 0, -k, k * o.padding, width - k * o.padding],
    transforms,
    lineWidth: o.absoluteStrokeWidth ? (o.strokeWidth * box) / o.size : o.strokeWidth,
    linecap: CAP[o.linecap],
    linejoin: JOIN[o.linejoin],
    ...(background ? { background } : {}),
    layers: [...layers].map(([id, ops]) => ({ id, ops })),
    title: o.title ?? p.defaultTitle,
  };
}
