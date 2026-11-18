/**
 * Geometry for the shape editor (Phase 8c): similarity transforms and mirroring of spec
 * primitives, path data, conversion of core's flat geometry back to primitives, and hit
 * testing. Transforms keep a primitive's type where the spec can express the result and
 * bake it to a path otherwise (a mirrored `use`, a rotated rectangle).
 */
import {
  cosSin,
  num,
  type Flat,
  type Paint,
  type PathPrimitive,
  type Primitive,
  type Segment,
  type Vec,
} from "@0xdolan/deq-core";

import { flatten } from "./custom.ts";

/** Grid centre: mirrors and rotations default to the middle of the 24-unit canvas. */
export const MID = 12;

/** `p' = [a c e; b d f] p` with its uniform scale and rotation angle (no reflection). */
export interface Similarity {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
  readonly scale: number;
  readonly angle: number;
}

export type Axis = "x" | "y";

export function apply(t: Similarity, [x, y]: Vec): Vec {
  return [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f];
}

function linear(t: Similarity, [x, y]: Vec): Vec {
  return [t.a * x + t.c * y, t.b * x + t.d * y];
}

export function translation(dx: number, dy: number): Similarity {
  return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy, scale: 1, angle: 0 };
}

/** Clockwise on screen by `deg` about `center`. */
export function rotation(deg: number, [cx, cy]: Vec = [MID, MID]): Similarity {
  const [cos, sin] = cosSin(deg);
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: cx - cos * cx + sin * cy,
    f: cy - sin * cx - cos * cy,
    scale: 1,
    angle: deg,
  };
}

export function scaling(k: number, [cx, cy]: Vec = [MID, MID]): Similarity {
  return { a: k, b: 0, c: 0, d: k, e: cx - k * cx, f: cy - k * cy, scale: k, angle: 0 };
}

/** Normalise an angle to [0, 360). */
export function normAngle(deg: number): number {
  const m = ((deg % 360) + 360) % 360;
  return round3(m) === 360 ? 0 : round3(m);
}

export function round3(n: number): number {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

const rp = ([x, y]: Vec): Vec => [round3(x), round3(y)];

// Path data -----------------------------------------------------------------------------

const PATH_TOKEN = /[MLHVCQZ]|-?(?:\d+\.?\d*|\.\d+)/gu;
const ARITY: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, Z: 0 };

/** Parse absolute `M L H V C Q Z` path data (the spec grammar) into segments. */
export function parsePathData(d: string): Segment[] {
  const tokens = d.match(PATH_TOKEN) ?? [];
  if (tokens.join("") !== d.replace(/\s+/gu, "") || tokens[0] !== "M") {
    throw new Error("unsupported path data");
  }
  const out: Segment[] = [];
  let cur: Vec = [0, 0];
  let start: Vec = cur;
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i] ?? "";
    const n = ARITY[cmd];
    if (n === undefined) throw new Error("expected a path command");
    const nums = tokens.slice(i + 1, i + 1 + n).map(Number);
    if (nums.length !== n) throw new Error(`${cmd} needs ${String(n)} numbers`);
    i += 1 + n;
    const at = (k: number): number => nums[k] ?? 0;
    switch (cmd) {
      case "M":
        cur = start = [at(0), at(1)];
        out.push(["M", cur]);
        break;
      case "L":
        cur = [at(0), at(1)];
        out.push(["L", cur]);
        break;
      case "H":
        cur = [at(0), cur[1]];
        out.push(["L", cur]);
        break;
      case "V":
        cur = [cur[0], at(0)];
        out.push(["L", cur]);
        break;
      case "Q":
        cur = [at(2), at(3)];
        out.push(["Q", [at(0), at(1)], cur]);
        break;
      case "C":
        cur = [at(4), at(5)];
        out.push(["C", [at(0), at(1)], [at(2), at(3)], cur]);
        break;
      default:
        out.push(["Z"]);
        cur = start;
    }
  }
  return out;
}

const pt = ([x, y]: Vec): string => `${num(x)} ${num(y)}`;

/** Serialise segments as spec path data: absolute commands separated by spaces. */
export function pathData(segments: readonly Segment[]): string {
  return segments
    .map((s) => {
      switch (s[0]) {
        case "M":
          return `M${pt(s[1])}`;
        case "L":
          return `L${pt(s[1])}`;
        case "Q":
          return `Q${pt(s[1])} ${pt(s[2])}`;
        case "C":
          return `C${pt(s[1])} ${pt(s[2])} ${pt(s[3])}`;
        default:
          return "Z";
      }
    })
    .join(" ");
}

export function mapSegments(segments: readonly Segment[], f: (p: Vec) => Vec): Segment[] {
  return segments.map((s): Segment => {
    switch (s[0]) {
      case "M":
        return ["M", f(s[1])];
      case "L":
        return ["L", f(s[1])];
      case "Q":
        return ["Q", f(s[1]), f(s[2])];
      case "C":
        return ["C", f(s[1]), f(s[2]), f(s[3])];
      default:
        return s;
    }
  });
}

// Flat geometry -> segments ---------------------------------------------------------------

/** Cubic pieces of an elliptical arc from `t0` to `t1` degrees, then rotated by `rot`. */
function arcSegments(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  t0: number,
  t1: number,
  rot = 0,
  move = true,
): Segment[] {
  const [rc, rs] = cosSin(rot);
  const at = (x: number, y: number): Vec => [cx + rc * x - rs * y, cy + rs * x + rc * y];
  const pieces = Math.max(1, Math.ceil(Math.abs(t1 - t0) / 90 - 1e-9));
  const step = (t1 - t0) / pieces;
  const k = (4 / 3) * Math.tan((step * Math.PI) / 720);
  const out: Segment[] = [];
  for (let i = 0; i < pieces; i++) {
    const [c0, s0] = cosSin(t0 + i * step);
    const [c1, s1] = cosSin(t0 + (i + 1) * step);
    if (i === 0 && move) out.push(["M", at(rx * c0, ry * s0)]);
    out.push([
      "C",
      at(rx * (c0 - k * s0), ry * (s0 + k * c0)),
      at(rx * (c1 + k * s1), ry * (s1 - k * c1)),
      at(rx * c1, ry * s1),
    ]);
  }
  return out;
}

/** Path segments of one flat item (dots at their plain radius). */
export function flatSegments(f: Flat): Segment[] {
  switch (f.kind) {
    case "poly": {
      const [first, ...rest] = f.points;
      if (!first) return [];
      const segs: Segment[] = [["M", first], ...rest.map((p): Segment => ["L", p])];
      return f.closed ? [...segs, ["Z"]] : segs;
    }
    case "circle":
      return [...arcSegments(f.cx, f.cy, f.r, f.r, 0, 360), ["Z"]];
    case "ellipse":
      return [...arcSegments(f.cx, f.cy, f.rx, f.ry, 0, 360, f.rotation), ["Z"]];
    case "arc": {
      const segs = arcSegments(f.cx, f.cy, f.r, f.r, f.start, Math.min(f.end, f.start + 360));
      return f.end - f.start >= 360 ? [...segs, ["Z"]] : segs;
    }
    case "path":
      return [...f.segments];
  }
}

/** Is the flat item a closed outline (or a filled area)? */
export function isClosedFlat(f: Flat): boolean {
  switch (f.kind) {
    case "poly":
      return f.closed;
    case "arc":
      return f.end - f.start >= 360;
    case "path":
      return f.segments.some((s) => s[0] === "Z");
    default:
      return true;
  }
}

/** Is the flat item drawn as a filled area? */
export function isFilledFlat(f: Flat): boolean {
  return f.paint === "fill" || (f.kind === "circle" && f.dot);
}

/**
 * Primitives drawing the given flat geometry: dots and filled circles stay circles, other
 * items merge into one path per paint (stroked first, then filled).
 */
export function flatsToPrimitives(flats: readonly Flat[]): Primitive[] {
  const out: Primitive[] = [];
  const paths: Record<Paint, Segment[]> = { stroke: [], fill: [] };
  for (const f of flats) {
    if (f.kind === "circle") {
      const [cx, cy] = rp([f.cx, f.cy]);
      if (f.dot)
        out.push(f.r === 1 ? { type: "dot", cx, cy } : { type: "dot", cx, cy, r: round3(f.r) });
      else
        out.push({
          type: "circle",
          cx,
          cy,
          r: round3(f.r),
          ...(f.paint === "fill" ? { paint: "fill" } : {}),
        });
      continue;
    }
    paths[f.paint].push(...mapSegments(flatSegments(f), rp));
  }
  for (const paint of ["stroke", "fill"] as const) {
    if (paths[paint].length === 0) continue;
    const prim: PathPrimitive = { type: "path", d: pathData(paths[paint]) };
    out.push(paint === "fill" ? { ...prim, paint } : prim);
  }
  return out;
}

/** The primitive as path primitives (dots stay dots). */
export function toPaths(prim: Primitive): Primitive[] {
  return flatsToPrimitives(flatten([prim]));
}

// Transforms ----------------------------------------------------------------------------

function bake(prim: Primitive, map: (p: Vec) => Vec): Primitive[] {
  const flats = flatten([prim]).map((f): Flat => {
    if (f.kind === "circle") {
      const [cx, cy] = map([f.cx, f.cy]);
      return { ...f, cx, cy };
    }
    return {
      kind: "path",
      segments: mapSegments(flatSegments(f), map),
      layer: f.layer,
      paint: f.paint,
    };
  });
  return flatsToPrimitives(flats);
}

/**
 * Apply a similarity transform. The result keeps the primitive's type except for shapes
 * the spec cannot rotate freely (rectangles and ellipses at other than right angles),
 * which become paths. Coordinates are rounded to 3 decimals.
 */
export function transformPrimitive(prim: Primitive, t: Similarity): Primitive[] {
  const P = (p: Vec): Vec => rp(apply(t, p));
  const k = t.scale;
  const quarter = normAngle(t.angle) % 90 === 0;
  switch (prim.type) {
    case "line": {
      const [x1, y1] = P([prim.x1, prim.y1]);
      const [x2, y2] = P([prim.x2, prim.y2]);
      return [{ ...prim, x1, y1, x2, y2 }];
    }
    case "polyline":
    case "polygon":
      return [{ ...prim, points: prim.points.map(P) }];
    case "path":
      return [{ ...prim, d: pathData(mapSegments(parsePathData(prim.d), P)) }];
    case "circle": {
      const [cx, cy] = P([prim.cx, prim.cy]);
      return [{ ...prim, cx, cy, r: round3(prim.r * k) }];
    }
    case "dot": {
      const [cx, cy] = P([prim.cx, prim.cy]);
      return [{ ...prim, cx, cy }];
    }
    case "arc": {
      const [cx, cy] = P([prim.cx, prim.cy]);
      const start = normAngle(prim.start + t.angle);
      return [
        {
          ...prim,
          cx,
          cy,
          r: round3(prim.r * k),
          start,
          end: round3(start + prim.end - prim.start),
        },
      ];
    }
    case "rect": {
      if (!quarter) return bake(prim, P);
      const a = P([prim.x, prim.y]);
      const b = P([prim.x + prim.width, prim.y + prim.height]);
      const x = Math.min(a[0], b[0]);
      const y = Math.min(a[1], b[1]);
      return [
        {
          ...prim,
          x,
          y,
          width: round3(Math.abs(b[0] - a[0])),
          height: round3(Math.abs(b[1] - a[1])),
        },
      ];
    }
    case "ellipse": {
      if (!quarter) return bake(prim, P);
      const [cx, cy] = P([prim.cx, prim.cy]);
      const swap = normAngle(t.angle) % 180 !== 0;
      const rx = round3((swap ? prim.ry : prim.rx) * k);
      const ry = round3((swap ? prim.rx : prim.ry) * k);
      return [{ ...prim, cx, cy, rx, ry }];
    }
    case "star": {
      const [cx, cy] = P([prim.cx, prim.cy]);
      return [
        {
          ...prim,
          cx,
          cy,
          outerRadius: round3(prim.outerRadius * k),
          innerRadius: round3(prim.innerRadius * k),
          rotation: normAngle(prim.rotation + t.angle),
        },
      ];
    }
    case "radial":
    case "concentric": {
      // T·R(θ, c) = R(θ, T(c))·T for a similarity, so the copy angles stay as they are.
      const element = transformPrimitive(prim.element, t);
      if (element.length !== 1 || !element[0]) return bake(prim, P);
      return [{ ...prim, center: P(prim.center), element: element[0] }];
    }
    case "repeat": {
      const element = transformPrimitive(prim.element, t);
      if (element.length !== 1 || !element[0]) return bake(prim, P);
      const L = (v: Vec): Vec => rp(linear(t, v));
      return [
        {
          ...prim,
          element: element[0],
          ...(prim.step ? { step: L(prim.step) } : {}),
          ...(prim.spread ? { spread: L(prim.spread) } : {}),
        },
      ];
    }
    case "use": {
      const tr = prim.transform ?? {};
      const origin = tr.origin ?? [MID, MID];
      const [tx, ty] = tr.translate ?? [0, 0];
      const moved = apply(t, [origin[0] + tx, origin[1] + ty]);
      const scale = round3((tr.scale ?? 1) * k);
      const rotate = normAngle((tr.rotate ?? 0) + t.angle);
      const translate = rp([moved[0] - origin[0], moved[1] - origin[1]]);
      return [
        {
          ...prim,
          transform: {
            ...(translate[0] || translate[1] ? { translate } : {}),
            ...(scale === 1 ? {} : { scale }),
            ...(rotate ? { rotate } : {}),
            ...(tr.origin ? { origin: tr.origin } : {}),
          },
        },
      ];
    }
  }
}

/** Mirror across the vertical (`x`) or horizontal (`y`) line through `at` (default 12). */
export function reflectPrimitive(prim: Primitive, axis: Axis, at = MID): Primitive[] {
  const M = ([x, y]: Vec): Vec => rp(axis === "x" ? [2 * at - x, y] : [x, 2 * at - y]);
  const Lv = ([x, y]: Vec): Vec => rp(axis === "x" ? [-x, y] : [x, -y]);
  switch (prim.type) {
    case "line": {
      const [x1, y1] = M([prim.x1, prim.y1]);
      const [x2, y2] = M([prim.x2, prim.y2]);
      return [{ ...prim, x1, y1, x2, y2 }];
    }
    case "polyline":
    case "polygon":
      return [{ ...prim, points: prim.points.map(M) }];
    case "path":
      return [{ ...prim, d: pathData(mapSegments(parsePathData(prim.d), M)) }];
    case "circle":
    case "dot":
    case "ellipse": {
      const [cx, cy] = M([prim.cx, prim.cy]);
      return [{ ...prim, cx, cy }];
    }
    case "rect": {
      const [x, y] = M([
        prim.x + (axis === "x" ? prim.width : 0),
        prim.y + (axis === "y" ? prim.height : 0),
      ]);
      return [{ ...prim, x, y }];
    }
    case "arc": {
      const [cx, cy] = M([prim.cx, prim.cy]);
      const flip = (a: number) => (axis === "x" ? 180 - a : -a);
      const start = normAngle(flip(prim.end));
      return [{ ...prim, cx, cy, start, end: round3(start + prim.end - prim.start) }];
    }
    case "radial": {
      // M·R(θ) = R(-θ)·M: mirror the element and centre, and run the copies the other way.
      const element = reflectPrimitive(prim.element, axis, at);
      if (element.length !== 1 || !element[0]) return bake(prim, M);
      const start = normAngle(prim.sweep >= 360 ? -prim.start : -prim.start - prim.sweep);
      return [{ ...prim, center: M(prim.center), start, element: element[0] }];
    }
    case "concentric": {
      const element = reflectPrimitive(prim.element, axis, at);
      if (element.length !== 1 || !element[0]) return bake(prim, M);
      return [{ ...prim, center: M(prim.center), element: element[0] }];
    }
    case "repeat": {
      const element = reflectPrimitive(prim.element, axis, at);
      if (element.length !== 1 || !element[0]) return bake(prim, M);
      return [
        {
          ...prim,
          element: element[0],
          ...(prim.step ? { step: Lv(prim.step) } : {}),
          ...(prim.spread ? { spread: Lv(prim.spread) } : {}),
        },
      ];
    }
    default:
      // `use` has no flip and star orientation depends on its point count: bake to paths.
      return bake(prim, M);
  }
}

// Hit testing ---------------------------------------------------------------------------

/** Sample a flat item as polylines in canvas units. */
export function samplePolylines(f: Flat): Vec[][] {
  const lines: Vec[][] = [];
  let line: Vec[] = [];
  let start: Vec = [0, 0];
  let cur: Vec = [0, 0];
  for (const s of flatSegments(f)) {
    switch (s[0]) {
      case "M":
        if (line.length > 1) lines.push(line);
        cur = start = s[1];
        line = [cur];
        break;
      case "L":
        cur = s[1];
        line.push(cur);
        break;
      case "Q":
      case "C": {
        const ctrl = s[0] === "Q" ? [cur, s[1], s[1], s[2]] : [cur, s[1], s[2], s[3]];
        const [p0, p1, p2, p3] = ctrl as [Vec, Vec, Vec, Vec];
        for (let i = 1; i <= 12; i++) {
          const t = i / 12;
          const u = 1 - t;
          const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
          line.push([
            w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0],
            w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1],
          ]);
        }
        cur = s[s.length - 1] as Vec;
        break;
      }
      default:
        line.push(start);
        cur = start;
    }
  }
  if (line.length > 1) lines.push(line);
  return lines;
}

function segDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t =
    len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function inside(p: Vec, poly: readonly Vec[]): boolean {
  let hit = false;
  let [xj, yj] = poly.at(-1) ?? [0, 0];
  for (const [xi, yi] of poly) {
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
    [xj, yj] = [xi, yi];
  }
  return hit;
}

/** Does the flat geometry pass within `tol` of `p` (or cover it, when filled)? */
export function hitsFlats(flats: readonly Flat[], p: Vec, tol: number): boolean {
  for (const f of flats) {
    for (const line of samplePolylines(f)) {
      if (isFilledFlat(f) && inside(p, line)) return true;
      let prev: Vec | undefined;
      for (const q of line) {
        if (prev && segDistance(p, prev, q) <= tol) return true;
        prev = q;
      }
    }
  }
  return false;
}

/** Index of the topmost primitive at `p`, or -1. */
export function hitTest(primitives: readonly Primitive[], p: Vec, tol: number): number {
  for (let i = primitives.length - 1; i >= 0; i--) {
    const prim = primitives[i];
    if (!prim) continue;
    try {
      if (hitsFlats(flatten([prim]), p, tol)) return i;
    } catch {
      // A primitive core rejects cannot be hit.
    }
  }
  return -1;
}
