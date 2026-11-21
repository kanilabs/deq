/**
 * Point editing for the shape editor (Phase 8c): anchors and Bézier handles of path
 * data, and the points of lines, polylines and polygons. Paths are edited as absolute
 * `M L C Z` segments; quadratic curves become cubic ones when a path is opened.
 */
import type { Primitive, Segment, Vec } from "@0xdolan/deq-core";

import { parsePathData, pathData, round3 } from "./geometry.ts";

/** Which point of a segment: its end (the anchor) or one of a cubic's control points. */
export type Handle = "end" | "c1" | "c2";

export interface PointRef {
  readonly i: number;
  readonly k: Handle;
}

/** One draggable point: an anchor, or a handle with the anchor it hangs from. */
export interface EditPoint extends PointRef {
  readonly p: Vec;
  readonly anchor?: Vec;
}

const lerp = (a: Vec, b: Vec, t: number): Vec => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const r3 = ([x, y]: Vec): Vec => [round3(x), round3(y)];

/** Path data as cubic-only segments ready for editing. */
export function editableSegments(d: string): Segment[] {
  const out: Segment[] = [];
  forEachSegment(parsePathData(d), (s, from) => {
    if (s[0] === "Q") {
      out.push(["C", r3(lerp(from, s[1], 2 / 3)), r3(lerp(s[2], s[1], 2 / 3)), s[2]]);
    } else out.push(s);
  });
  return out;
}

/** Visit segments with the point each one starts from. */
function forEachSegment(
  segs: readonly Segment[],
  fn: (s: Segment, from: Vec, i: number) => void,
): void {
  let cur: Vec = [0, 0];
  let start: Vec = cur;
  segs.forEach((s, i) => {
    fn(s, cur, i);
    if (s[0] === "M") cur = start = s[1];
    else if (s[0] === "Z") cur = start;
    else cur = s[s.length - 1] as Vec;
  });
}

function endOf(s: Segment | undefined): Vec | undefined {
  return s && s[0] !== "Z" ? (s[s.length - 1] as Vec) : undefined;
}

/** Anchors and handles of segments, in drawing order. */
export function editPoints(segs: readonly Segment[]): EditPoint[] {
  const out: EditPoint[] = [];
  forEachSegment(segs, (s, from, i) => {
    if (s[0] === "Z") return;
    if (s[0] === "C") {
      out.push({ i, k: "c1", p: s[1], anchor: from });
      out.push({ i, k: "c2", p: s[2], anchor: s[3] });
    }
    out.push({ i, k: "end", p: s[s.length - 1] as Vec });
  });
  return out;
}

function withEnd(s: Segment, p: Vec): Segment {
  switch (s[0]) {
    case "M":
      return ["M", p];
    case "L":
      return ["L", p];
    case "Q":
      return ["Q", s[1], p];
    case "C":
      return ["C", s[1], s[2], p];
    default:
      return s;
  }
}

/**
 * Move a point. Moving an anchor carries its two handles along, like other editors.
 */
export function movePoint(segs: readonly Segment[], ref: PointRef, p: Vec): Segment[] {
  const out = [...segs];
  const s = out[ref.i];
  if (!s || s[0] === "Z") return out;
  if (ref.k === "c1" && s[0] === "C") out[ref.i] = ["C", p, s[2], s[3]];
  else if (ref.k === "c2" && s[0] === "C") out[ref.i] = ["C", s[1], p, s[3]];
  else if (ref.k === "end") {
    const old = endOf(s);
    if (!old) return out;
    const dx = p[0] - old[0];
    const dy = p[1] - old[1];
    const shift = (q: Vec): Vec => r3([q[0] + dx, q[1] + dy]);
    out[ref.i] = s[0] === "C" ? ["C", s[1], shift(s[2]), p] : withEnd(s, p);
    const next = out[ref.i + 1];
    if (next?.[0] === "C") out[ref.i + 1] = ["C", shift(next[1]), next[2], next[3]];
  }
  return out;
}

/** Split the segment that ends at anchor `i` (or, for a start point, the next one) in half. */
export function insertPoint(segs: readonly Segment[], i: number): Segment[] {
  const at = segs[i]?.[0] === "M" ? i + 1 : i;
  const target = segs[at];
  const out = [...segs];
  if (!target || target[0] === "M") return out;
  let from: Vec = [0, 0];
  let start: Vec = [0, 0];
  forEachSegment(segs, (s, f, k) => {
    if (k === at) from = f;
    if (s[0] === "M" && k < at) start = s[1];
  });
  if (target[0] === "Z") {
    // Closing edge: add a corner half way back to the start.
    out.splice(at, 0, ["L", r3(lerp(from, start, 0.5))]);
    return out;
  }
  if (target[0] === "C") {
    const [, c1, c2, p] = target;
    const a = lerp(from, c1, 0.5);
    const b = lerp(c1, c2, 0.5);
    const c = lerp(c2, p, 0.5);
    const d = lerp(a, b, 0.5);
    const e = lerp(b, c, 0.5);
    const m = lerp(d, e, 0.5);
    out.splice(at, 1, ["C", r3(a), r3(d), r3(m)], ["C", r3(e), r3(c), p]);
    return out;
  }
  const end = endOf(target) ?? from;
  out.splice(at, 0, ["L", r3(lerp(from, end, 0.5))]);
  return out;
}

/** Anchors in the subpath that contains segment `i`. */
function subpathAnchors(segs: readonly Segment[], i: number): number {
  let lo = i;
  while (lo > 0 && segs[lo]?.[0] !== "M") lo--;
  let n = 0;
  for (let k = lo; k < segs.length; k++) {
    const s = segs[k];
    if (k > lo && s?.[0] === "M") break;
    if (s && s[0] !== "Z") n++;
  }
  return n;
}

/**
 * Remove anchor `i`. A subpath keeps at least two anchors.
 * @returns the new segments, or undefined when the point cannot be removed.
 */
export function deletePoint(segs: readonly Segment[], i: number): Segment[] | undefined {
  const s = segs[i];
  if (!s || s[0] === "Z" || subpathAnchors(segs, i) <= 2) return undefined;
  const out = [...segs];
  if (s[0] === "M") {
    const next = endOf(out[i + 1]);
    if (!next) return undefined;
    out.splice(i, 2, ["M", next]);
  } else out.splice(i, 1);
  return out;
}

/** Turn the segment ending at anchor `i` from a line into a curve, or back. */
export function toggleCurve(segs: readonly Segment[], i: number): Segment[] {
  const out = [...segs];
  forEachSegment(segs, (s, from, k) => {
    if (k !== i) return;
    if (s[0] === "L")
      out[k] = ["C", r3(lerp(from, s[1], 1 / 3)), r3(lerp(from, s[1], 2 / 3)), s[1]];
    else if (s[0] === "C" || s[0] === "Q") out[k] = ["L", s[s.length - 1] as Vec];
  });
  return out;
}

/** Close the last subpath, or open it if it is closed. */
export function toggleClosed(segs: readonly Segment[]): Segment[] {
  return segs.at(-1)?.[0] === "Z" ? segs.slice(0, -1) : [...segs, ["Z"]];
}

export function isClosed(segs: readonly Segment[]): boolean {
  return segs.at(-1)?.[0] === "Z";
}

// Points of other primitives --------------------------------------------------------------

/** Editable points of a line, polyline, polygon or path, or none. */
export function primitivePoints(prim: Primitive): EditPoint[] {
  switch (prim.type) {
    case "line":
      return [
        { i: 0, k: "end", p: [prim.x1, prim.y1] },
        { i: 1, k: "end", p: [prim.x2, prim.y2] },
      ];
    case "polyline":
    case "polygon":
      return prim.points.map((p, i) => ({ i, k: "end", p }));
    case "path":
      return editPoints(editableSegments(prim.d));
    default:
      return [];
  }
}

/** Move one point of a primitive (see {@link primitivePoints}). */
export function setPrimitivePoint(prim: Primitive, ref: PointRef, p: Vec): Primitive {
  const q = r3(p);
  switch (prim.type) {
    case "line":
      return ref.i === 0 ? { ...prim, x1: q[0], y1: q[1] } : { ...prim, x2: q[0], y2: q[1] };
    case "polyline":
    case "polygon":
      return { ...prim, points: prim.points.map((old, i) => (i === ref.i ? q : old)) };
    case "path":
      return { ...prim, d: pathData(movePoint(editableSegments(prim.d), ref, q)) };
    default:
      return prim;
  }
}

/** Apply a segment edit to a path primitive. */
export function editPath(
  prim: Primitive,
  edit: (segs: Segment[]) => Segment[] | undefined,
): Primitive | undefined {
  if (prim.type !== "path") return undefined;
  const next = edit(editableSegments(prim.d));
  return next ? { ...prim, d: pathData(next) } : undefined;
}
