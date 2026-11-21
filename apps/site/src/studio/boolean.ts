/**
 * Boolean operations for the shape editor (Phase 8c), on paper.js (`paper-core`, which has
 * no PaperScript and no `eval`, so it runs under the strict CSP). The library is loaded on
 * first use only. Each operand is the closed outline of a part; the result is one path.
 */
import type { Primitive, Segment, Vec } from "@0xdolan/deq-core";

import { CUSTOM_LIMITS, flatten } from "./custom.ts";
import { flatSegments, isClosedFlat, isFilledFlat, pathData, round3 } from "./geometry.ts";

export const BOOL_OPS = ["unite", "subtract", "intersect", "exclude"] as const;
export type BoolOp = (typeof BOOL_OPS)[number];

/** `open`: a part has no closed outline; `empty`: nothing is left; `complex`: too long. */
export type BoolErrorCode = "open" | "empty" | "complex" | "count";

export class BooleanError extends Error {
  override name = "BooleanError";
  constructor(readonly code: BoolErrorCode) {
    super(`boolean operation failed: ${code}`);
  }
}

// The few paper.js members used here.
interface PaperPoint {
  readonly x: number;
  readonly y: number;
}
interface PaperSegment {
  readonly point: PaperPoint;
  readonly handleIn: PaperPoint;
  readonly handleOut: PaperPoint;
}
interface PaperPath {
  readonly closed: boolean;
  readonly segments?: readonly PaperSegment[];
  readonly children?: readonly PaperPath[];
  unite(other: PaperPath, options: { insert: false }): PaperPath;
  subtract(other: PaperPath, options: { insert: false }): PaperPath;
  intersect(other: PaperPath, options: { insert: false }): PaperPath;
  exclude(other: PaperPath, options: { insert: false }): PaperPath;
}
interface PaperScope {
  setup(size: unknown): void;
  readonly Size: new (w: number, h: number) => unknown;
  readonly CompoundPath: new (options: { pathData: string; insert: false }) => PaperPath;
}
interface PaperModule {
  readonly PaperScope: new () => PaperScope;
}
export type PaperLoader = () => Promise<unknown>;

const defaultLoader: PaperLoader = () => import("paper/dist/paper-core");
let ready: Promise<PaperScope> | undefined;

/** Load paper.js once and set up a canvas-less scope. */
export function loadPaper(load: PaperLoader = defaultLoader): Promise<PaperScope> {
  ready ??= load().then((mod) => {
    const paper = ((mod as { default?: PaperModule }).default ?? mod) as PaperModule;
    const scope = new paper.PaperScope();
    scope.setup(new scope.Size(24, 24));
    return scope;
  });
  return ready;
}

/** Closed outlines of a part as path data, and whether the part is filled. */
export function outline(prim: Primitive): { d: string; filled: boolean } {
  const flats = flatten([prim]).filter(isClosedFlat);
  if (flats.length === 0) throw new BooleanError("open");
  return {
    d: pathData(flats.flatMap(flatSegments)),
    filled: flats.every(isFilledFlat),
  };
}

const isZero = (p: PaperPoint): boolean => Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9;
const vec = (p: PaperPoint, h?: PaperPoint): Vec => [
  round3(p.x + (h?.x ?? 0)),
  round3(p.y + (h?.y ?? 0)),
];

/** paper.js geometry as absolute `M L C Z` segments. */
export function paperSegments(item: PaperPath): Segment[] {
  const out: Segment[] = [];
  const paths = item.children ?? [item];
  for (const path of paths) {
    const segs = path.segments ?? [];
    const first = segs[0];
    if (!first) continue;
    out.push(["M", vec(first.point)]);
    const curve = (a: PaperSegment, b: PaperSegment): void => {
      if (isZero(a.handleOut) && isZero(b.handleIn)) out.push(["L", vec(b.point)]);
      else out.push(["C", vec(a.point, a.handleOut), vec(b.point, b.handleIn), vec(b.point)]);
    };
    let last = first;
    for (const seg of segs.slice(1)) {
      curve(last, seg);
      last = seg;
    }
    if (path.closed) {
      if (last !== first) curve(last, first);
      out.push(["Z"]);
    }
  }
  return out;
}

/**
 * Combine parts, bottom first: union, the first minus the rest, the common area, or the
 * areas covered an odd number of times. The result is filled when every part is filled.
 *
 * @throws {BooleanError}
 */
export async function booleanOp(
  op: BoolOp,
  parts: readonly Primitive[],
  load: PaperLoader = defaultLoader,
): Promise<Primitive> {
  if (parts.length < 2) throw new BooleanError("count");
  const outlines = parts.map(outline);
  const scope = await loadPaper(load);
  const paths = outlines.map((o) => new scope.CompoundPath({ pathData: o.d, insert: false }));
  const [first, ...rest] = paths as [PaperPath, ...PaperPath[]];
  const result = rest.reduce((acc, p) => acc[op](p, { insert: false }), first);
  const segments = paperSegments(result);
  if (segments.length === 0) throw new BooleanError("empty");
  const d = pathData(segments);
  if (d.length > CUSTOM_LIMITS.path) throw new BooleanError("complex");
  return outlines.every((o) => o.filled) ? { type: "path", d, paint: "fill" } : { type: "path", d };
}
