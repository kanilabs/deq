/** Seeded pattern generator: bands, grids, rosettes and borders of Deq motifs (ADR 0015). */
import { DeqError, cosSin, getShape, listShapes } from "@0xdolan/deq-core";
import * as v from "valibot";

import { MAX_SEED, Random } from "./random.js";
import { resolveSceneOptions, sceneSvg } from "./scene.js";
import type { Cell, Scene, SceneOptions } from "./scene.js";

/** The kinds of pattern. */
export type PatternKind = "band" | "grid" | "rosette" | "border";

/** Options of {@link pattern}; the render options apply to the whole pattern. */
export type PatternOptions = SceneOptions & {
  /** Default `band`. */
  readonly kind?: PatternKind;
  /** Seed (unsigned 32-bit). The same seed and options give the same pattern. Default 1. */
  readonly seed?: number;
  /** Shapes to choose motifs from (1..64 catalog ids). Default: every catalog shape. */
  readonly motifs?: readonly string[];
  /** Band: number of cells, odd, 3..63. Default 9. */
  readonly count?: number;
  /** Grid and border: columns, 1..32 (border: 3..32). Default 5 (border: 7). */
  readonly cols?: number;
  /** Grid and border: rows, 1..32 (border: 3..32). Default 5 (border: 3). */
  readonly rows?: number;
  /** Rosette: number of petals, 3..24. Default 8. */
  readonly petals?: number;
  /** Space between cells in grid units (0..24). Default 2. */
  readonly spacing?: number;
};

/** The result of {@link pattern}. */
export interface PatternResult {
  /** The SVG document, one `<g data-layer="cN">` per motif. */
  readonly svg: string;
  /** The motifs chosen, in the order the pattern uses them. */
  readonly motifs: readonly string[];
  readonly scene: Scene;
}

const ID = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u), v.maxLength(64));
const int = (min: number, max: number) =>
  v.optional(v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max)));
const PatternSchema = v.object({
  kind: v.optional(v.picklist(["band", "grid", "rosette", "border"])),
  seed: int(0, MAX_SEED),
  motifs: v.optional(v.pipe(v.array(ID), v.minLength(1), v.maxLength(64))),
  count: v.optional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(3),
      v.maxValue(63),
      v.check((n) => n % 2 === 1, "must be odd"),
    ),
  ),
  cols: int(1, 32),
  rows: int(1, 32),
  petals: int(3, 24),
  spacing: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(24))),
});

function fail(issue: string): DeqError {
  return new DeqError("INVALID_OPTIONS", `invalid pattern options: ${issue}`, [issue]);
}

/** `count` distinct motifs from `pool` (repeating only when the pool is smaller). */
function choose(pool: readonly string[], count: number, random: Random): string[] {
  const left = [...pool];
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if (left.length === 0) left.push(...pool);
    out.push(...left.splice(random.below(left.length), 1));
  }
  return out;
}

/** The motif at `i`, wrapping round `list` (never empty). */
const nth = (list: readonly string[], i: number): string => list[i % list.length] ?? "";

const cell = (x: number, y: number, shape: string, rotate = 0, scale = 1): Cell => ({
  x,
  y,
  glyph: [
    {
      shape,
      ...(rotate === 0 && scale === 1
        ? {}
        : {
            transform: { ...(scale === 1 ? {} : { scale }), ...(rotate === 0 ? {} : { rotate }) },
          }),
    },
  ],
});

/**
 * Generate a pattern of Deq motifs. `band` repeats motifs in a row (alternating or
 * mirrored), `grid` lays a checkerboard, `rosette` rings petals round a centre and
 * `border` frames a rectangle with corner and edge motifs.
 *
 * ```ts
 * pattern({ kind: "rosette", seed: 7, petals: 12 }).svg;
 * ```
 *
 * @throws {DeqError} `INVALID_OPTIONS`, `UNKNOWN_SHAPE` or `LIMIT_EXCEEDED`.
 */
export function pattern(options: PatternOptions = {}): PatternResult {
  const { kind, seed, motifs, count, cols, rows, petals, spacing, ...scene } = options;
  const parsed = v.safeParse(PatternSchema, {
    kind,
    seed,
    motifs,
    count,
    cols,
    rows,
    petals,
    spacing,
  });
  if (!parsed.success) {
    const issue = parsed.issues
      .map((i) => `${(i.path ?? []).map((p) => String(p.key)).join(".")}: ${i.message}`)
      .join("; ");
    throw fail(issue);
  }
  resolveSceneOptions(scene);
  const pool = motifs ?? listShapes().map((s) => s.id);
  for (const id of pool) getShape(id);
  const random = new Random(seed ?? 1);
  const step = 24 + (spacing ?? 2);
  const k = kind ?? "band";
  let used: string[];
  let placed: Scene;
  if (k === "band") {
    const n = count ?? 9;
    const mirror = random.below(2) === 1;
    used = choose(pool, mirror ? 3 : 2, random);
    const cells = Array.from({ length: n }, (_, i) =>
      cell(i * step, 0, nth(used, mirror ? Math.min(i, n - 1 - i) : i)),
    );
    placed = { width: n * step - (step - 24), height: 24, cells };
  } else if (k === "grid") {
    const c = cols ?? 5;
    const r = rows ?? 5;
    used = choose(pool, 2, random);
    const cells: Cell[] = [];
    for (let y = 0; y < r; y += 1) {
      for (let x = 0; x < c; x += 1) cells.push(cell(x * step, y * step, nth(used, x + y)));
    }
    placed = { width: c * step - (step - 24), height: r * step - (step - 24), cells };
  } else if (k === "rosette") {
    const n = petals ?? 8;
    used = choose(pool, 2, random);
    const centre = nth(used, 0);
    const petal = nth(used, 1);
    const cells: Cell[] = [cell(step, step, centre)];
    for (let i = 0; i < n; i += 1) {
      const angle = (360 * i) / n;
      const [c, s] = cosSin(angle);
      cells.push(cell(step + step * s, step - step * c, petal, angle, 0.75));
    }
    placed = { width: 2 * step + 24, height: 2 * step + 24, cells };
  } else {
    const c = cols ?? 7;
    const r = rows ?? 3;
    if (c < 3 || r < 3) throw fail("cols, rows: a border needs at least 3 x 3 cells");
    used = choose(pool, 2, random);
    const corner = nth(used, 0);
    const edge = nth(used, 1);
    const cells: Cell[] = [];
    const right = (c - 1) * step;
    const bottom = (r - 1) * step;
    for (let x = 0; x < c; x += 1) {
      const end = x === 0 || x === c - 1;
      cells.push(cell(x * step, 0, end ? corner : edge, end && x > 0 ? 90 : 0));
    }
    for (let y = 1; y < r - 1; y += 1) cells.push(cell(right, y * step, edge, 90));
    for (let x = c - 1; x >= 0; x -= 1) {
      const end = x === 0 || x === c - 1;
      cells.push(cell(x * step, bottom, end ? corner : edge, end ? (x > 0 ? 180 : 270) : 180));
    }
    for (let y = r - 2; y >= 1; y -= 1) cells.push(cell(0, y * step, edge, 270));
    placed = { width: right + 24, height: bottom + 24, cells };
  }
  const title = `Deq ${k} pattern`;
  return { svg: sceneSvg(placed, scene, title), motifs: used, scene: placed };
}
