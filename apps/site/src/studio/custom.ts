/**
 * Custom shapes (Phase 8c): shapes users compose in the Studio shape editor. A custom
 * shape is stored as a small definition (id, version, name, primitives) whose primitives
 * are a subset of the spec format, so core renders it like a catalog shape and it exports
 * as spec JSON (PRD §8.5). Every definition that enters the Studio (IndexedDB, designs,
 * imported files) goes through {@link parseCustomDef}.
 */
import {
  MAX_FLAT,
  expandShape,
  hasShape,
  type Flat,
  type Primitive,
  type ShapeData,
} from "@0xdolan/deq-core";
import * as v from "valibot";

/** Ids of custom shapes start with `u-`, which no catalog id does. */
export const CUSTOM_ID = /^u-[a-z0-9]{1,24}$/u;
/** The single layer every custom shape draws in. */
export const CUSTOM_LAYER = "main";

/** Caps that mirror `spec/schema/shape.schema.json`, plus Studio-wide limits. */
export const CUSTOM_LIMITS = {
  /** Custom shapes in the library or embedded in one design. */
  shapes: 100,
  primitives: 64,
  points: 64,
  path: 2000,
  name: 80,
  count: 64,
} as const;

/** What the Studio stores for a custom shape. */
export interface CustomDef {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly primitives: readonly Primitive[];
}

/** Why a custom shape was rejected. */
export class CustomShapeError extends Error {
  override name = "CustomShapeError";
}

export function isCustomId(id: string): boolean {
  return CUSTOM_ID.test(id);
}

/** A fresh custom id: `u-` and 12 random base-36 characters. */
export function newCustomId(random: (n: number) => Uint8Array = randomBytes): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  return `u-${Array.from(random(12), (b) => alphabet[b % 36] ?? "0").join("")}`;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** The shape core renders for a definition: one layer, no parameters. */
export function toShapeData(def: CustomDef): ShapeData {
  return {
    id: def.id,
    version: def.version,
    category: "compositions",
    names: {
      en: def.name,
      ckb: { text: null, status: "needs-native-review" },
      kmr: { text: null, status: "needs-native-review" },
    },
    aliases: [],
    tags: [],
    layers: [CUSTOM_LAYER],
    symmetry: "none",
    parameters: {},
    primitives: def.primitives.map((p) => ({ ...p, layer: CUSTOM_LAYER })),
  };
}

/** Flat geometry of a definition (or of a list of primitives). */
export function flatten(primitives: readonly Primitive[]): Flat[] {
  return expandShape(toShapeData({ id: "u-draft", version: 1, name: "draft", primitives }));
}

// Schema --------------------------------------------------------------------------------

const finite = v.pipe(v.number(), v.finite());
const coord = v.pipe(finite, v.minValue(0), v.maxValue(24));
const positive = v.pipe(finite, v.gtValue(0), v.maxValue(24));
const angle = v.pipe(finite, v.minValue(-360), v.maxValue(720));
const span = v.pipe(finite, v.minValue(-24), v.maxValue(24));
const point = v.tuple([coord, coord]);
const vector = v.tuple([span, span]);
const count = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(CUSTOM_LIMITS.count));
const paint = v.optional(v.picklist(["stroke", "fill"]));
const points = (min: number) =>
  v.pipe(v.array(point), v.minLength(min), v.maxLength(CUSTOM_LIMITS.points));
const pathData = v.pipe(
  v.string(),
  v.maxLength(CUSTOM_LIMITS.path),
  v.regex(/^M[ 0-9.MLHVCQZ-]*$/u, "path data must use absolute M L H V C Q Z commands"),
);
const catalogId = v.pipe(
  v.string(),
  v.maxLength(64),
  v.check((id) => hasShape(id), "unknown shape"),
);

// Spec files may carry `id`, `layer` and `when`; custom shapes have one layer and no
// parameters, so `id` and `layer` are accepted and dropped, and `when` is refused.
const common = { id: v.optional(v.string()), layer: v.optional(v.string()) };

// Typed loosely: the output is checked against core by checkPrimitives after `strip`.
const PrimitiveSchema: v.GenericSchema = v.lazy(() =>
  v.variant("type", [
    v.strictObject({
      ...common,
      type: v.literal("line"),
      x1: coord,
      y1: coord,
      x2: coord,
      y2: coord,
    }),
    v.strictObject({ ...common, type: v.literal("polyline"), points: points(2) }),
    v.strictObject({ ...common, type: v.literal("polygon"), points: points(3), paint }),
    v.strictObject({ ...common, type: v.literal("path"), d: pathData, paint }),
    v.strictObject({
      ...common,
      type: v.literal("circle"),
      cx: coord,
      cy: coord,
      r: positive,
      paint,
    }),
    v.strictObject({
      ...common,
      type: v.literal("dot"),
      cx: coord,
      cy: coord,
      r: v.optional(positive),
    }),
    v.strictObject({
      ...common,
      type: v.literal("arc"),
      cx: coord,
      cy: coord,
      r: positive,
      start: angle,
      end: angle,
    }),
    v.strictObject({
      ...common,
      type: v.literal("ellipse"),
      cx: coord,
      cy: coord,
      rx: positive,
      ry: positive,
      paint,
    }),
    v.strictObject({
      ...common,
      type: v.literal("rect"),
      x: coord,
      y: coord,
      width: positive,
      height: positive,
      paint,
    }),
    v.strictObject({
      ...common,
      type: v.literal("star"),
      cx: coord,
      cy: coord,
      points: count,
      outerRadius: positive,
      innerRadius: positive,
      rotation: angle,
      paint,
    }),
    v.strictObject({
      ...common,
      type: v.literal("radial"),
      count,
      center: point,
      start: angle,
      sweep: v.pipe(finite, v.gtValue(0), v.maxValue(360)),
      element: PrimitiveSchema,
    }),
    v.strictObject({
      ...common,
      type: v.literal("repeat"),
      count,
      step: v.optional(vector),
      spread: v.optional(vector),
      align: v.optional(v.picklist(["start", "center"])),
      element: PrimitiveSchema,
    }),
    v.strictObject({
      ...common,
      type: v.literal("concentric"),
      count,
      center: point,
      scaleStep: v.pipe(finite, v.gtValue(0), v.ltValue(1)),
      element: PrimitiveSchema,
    }),
    v.strictObject({
      ...common,
      type: v.literal("use"),
      shape: catalogId,
      params: v.optional(
        v.pipe(
          v.record(v.string(), v.union([v.pipe(v.number(), v.integer()), v.boolean(), v.string()])),
          v.check((p) => Object.keys(p).length <= 8, "too many parameters"),
        ),
      ),
      transform: v.optional(
        v.strictObject({
          translate: v.optional(vector),
          scale: v.optional(v.pipe(finite, v.gtValue(0), v.maxValue(4))),
          rotate: v.optional(angle),
          origin: v.optional(point),
        }),
      ),
    }),
  ]),
);

const DefSchema = v.object({
  id: v.pipe(v.string(), v.maxLength(64)),
  version: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000)),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(CUSTOM_LIMITS.name)),
  primitives: v.pipe(
    v.array(PrimitiveSchema),
    v.minLength(1),
    v.maxLength(CUSTOM_LIMITS.primitives),
  ),
});

/** Remove `id`/`layer` at every level so stored primitives stay canonical. */
function strip(prim: unknown): Primitive {
  const rest = Object.fromEntries(
    Object.entries(prim as object).filter(([k]) => k !== "id" && k !== "layer"),
  ) as unknown as Primitive;
  if ("element" in rest) return { ...rest, element: strip(rest.element) };
  return rest;
}

function message(issues: readonly v.BaseIssue<unknown>[]): string {
  const issue = issues[0];
  const path = issue?.path?.map((p) => String(p.key)).join(".") ?? "";
  return `${path ? `${path}: ` : ""}${issue?.message ?? "invalid"}`;
}

/** Check that core accepts the primitives (references, depth, flat-item limit). */
export function checkPrimitives(primitives: readonly Primitive[]): void {
  let flats: Flat[];
  try {
    flats = flatten(primitives);
  } catch (error) {
    throw new CustomShapeError((error as Error).message);
  }
  if (flats.length === 0) throw new CustomShapeError("the shape draws nothing");
  if (flats.length > MAX_FLAT) throw new CustomShapeError("the shape is too complex");
}

/**
 * Validate an untrusted custom shape definition.
 *
 * @throws {CustomShapeError} with the first problem found.
 */
export function parseCustomDef(value: unknown): CustomDef {
  const result = v.safeParse(DefSchema, value);
  if (!result.success) throw new CustomShapeError(`invalid shape: ${message(result.issues)}`);
  const { id, version, name, primitives } = result.output;
  if (!isCustomId(id)) throw new CustomShapeError("invalid shape: id: must look like u-abc123");
  const clean = primitives.map(strip);
  checkPrimitives(clean);
  return { id, version, name, primitives: clean };
}

/** Validate a list of definitions with unique ids (a design's `shapes`, the library). */
export function parseCustomDefs(value: unknown): CustomDef[] {
  if (!Array.isArray(value)) throw new CustomShapeError("invalid shapes: expected a list");
  if (value.length > CUSTOM_LIMITS.shapes) throw new CustomShapeError("invalid shapes: too many");
  const ids = new Set<string>();
  return value.map((raw, i) => {
    let def: CustomDef;
    try {
      def = parseCustomDef(raw);
    } catch (error) {
      throw new CustomShapeError(`shapes.${String(i)}: ${(error as Error).message}`);
    }
    if (ids.has(def.id)) throw new CustomShapeError(`shapes.${String(i)}.id: duplicate id`);
    ids.add(def.id);
    return def;
  });
}

// Spec JSON -------------------------------------------------------------------------------

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Bounding box `[x, y, w, h]` of flat geometry, ignoring stroke width. */
export function flatBox(flats: readonly Flat[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (x: number, y: number, r = 0): void => {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  };
  for (const f of flats) {
    switch (f.kind) {
      case "poly":
        for (const [x, y] of f.points) add(x, y);
        break;
      case "circle":
      case "arc":
        add(f.cx, f.cy, f.r);
        break;
      case "ellipse":
        add(f.cx, f.cy, Math.max(f.rx, f.ry));
        break;
      case "path":
        for (const seg of f.segments) for (const p of seg.slice(1) as [number, number][]) add(...p);
    }
  }
  if (x0 === Infinity) return [0, 0, 0, 0];
  return [round3(x0), round3(y0), round3(x1 - x0), round3(y1 - y0)];
}

/**
 * The definition as a file in the spec format (`spec/shapes/<id>.json`), valid against
 * `spec/schema/shape.schema.json`. Metrics are estimates; `deq-spec fmt` recomputes them.
 */
export function toSpecJson(def: CustomDef): string {
  const flats = flatten(def.primitives);
  const [x, y, w, h] = flatBox(flats);
  const clamp = (n: number) => Math.min(24, Math.max(0, round3(n)));
  const visual: [number, number, number, number] = [x - 1, y - 1, w + 2, h + 2].map(round3) as [
    number,
    number,
    number,
    number,
  ];
  const spec = {
    $schema: "../schema/shape.schema.json",
    id: def.id,
    version: def.version,
    category: "compositions",
    names: {
      en: def.name,
      ckb: { text: null, status: "needs-native-review", sources: [], images: [] },
      kmr: { text: null, status: "needs-native-review", sources: [], images: [] },
      terms: [],
    },
    aliases: [],
    tags: ["custom"],
    meaning: { status: "unknown" },
    sources: [],
    layers: [CUSTOM_LAYER],
    primitives: def.primitives.map((p) => ({ ...p, layer: CUSTOM_LAYER })),
    symmetry: "none",
    parameters: {},
    construction: ["Made in the Deq Studio shape editor."],
    references: { images: [], files: [] },
    metrics: {
      bbox: [x, y, w, h],
      visualBox: visual,
      opticalCenter: [clamp(x + w / 2), clamp(y + h / 2)],
      strokeToSize: round3(2 / Math.max(visual[2], visual[3], 1)),
      primitiveCount: Math.max(1, flats.length),
    },
  };
  return `${JSON.stringify(spec, null, 2)}\n`;
}

/** The fields of a spec file the importer reads. */
interface SpecLike {
  readonly id?: unknown;
  readonly version?: unknown;
  readonly names?: unknown;
  readonly parameters?: unknown;
  readonly primitives?: unknown;
}

/**
 * Read a spec JSON file (one exported by {@link toSpecJson}, or a catalog shape without
 * parameters) as a custom definition. Fields other than id, version, names and
 * primitives are ignored. Ids that are not custom ids, or that `taken` reports as used,
 * get a fresh id.
 *
 * @throws {CustomShapeError} when the file is not a usable shape.
 */
export function fromSpecJson(
  text: string,
  taken: (id: string) => boolean = () => false,
  makeId: () => string = newCustomId,
): CustomDef {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CustomShapeError("invalid shape: not a JSON file");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new CustomShapeError("invalid shape: expected a JSON object");
  const r = raw as SpecLike;
  if (r.parameters && typeof r.parameters === "object" && Object.keys(r.parameters).length > 0)
    throw new CustomShapeError("invalid shape: custom shapes cannot have parameters");
  const id = typeof r.id === "string" && isCustomId(r.id) && !taken(r.id) ? r.id : makeId();
  const en = r.names && typeof r.names === "object" ? (r.names as { en?: unknown }).en : undefined;
  return parseCustomDef({
    id,
    version: r.version ?? 1,
    name: typeof en === "string" ? en : r.id,
    primitives: r.primitives,
  });
}
