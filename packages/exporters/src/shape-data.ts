/**
 * Validation for shapes given as data ({@link DataItem}). Core trusts its generated catalog,
 * so a shape from anywhere else must pass this schema first: every primitive type and field
 * of `spec/schema/shape.schema.json` that core renders, with finite, bounded numbers and
 * bounded strings and arrays. Unknown primitive types are rejected (core would skip them).
 */
import { DeqError } from "@0xdolan/deq-core";
import type { ShapeData } from "@0xdolan/deq-core";
import * as v from "valibot";

/** Kebab-case ids: shape ids, layers, parameters and file names. */
export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const Id = v.pipe(v.string(), v.regex(KEBAB), v.maxLength(64));
const Text = v.pipe(v.string(), v.maxLength(200));
const Num = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const Int = v.pipe(Num, v.integer());
const Vec = v.tuple([Num, Num]);
const Points = v.pipe(v.array(Vec), v.minLength(2), v.maxLength(512));
const ParamValue = v.union([Num, v.boolean(), Text]);
const Count = v.union([v.pipe(Int, v.minValue(0), v.maxValue(512)), v.strictObject({ param: Id })]);
const Paint = v.optional(v.picklist(["stroke", "fill"]));

const common = {
  id: v.optional(Id),
  layer: v.optional(Id),
  when: v.optional(
    v.record(Id, v.union([ParamValue, v.pipe(v.array(v.union([Num, Text])), v.maxLength(64))])),
  ),
};

type PrimitiveSchema = v.GenericSchema;
const Element: PrimitiveSchema = v.lazy(() => Primitive);

const Primitive: PrimitiveSchema = v.variant("type", [
  v.strictObject({ ...common, type: v.literal("line"), x1: Num, y1: Num, x2: Num, y2: Num }),
  v.strictObject({ ...common, type: v.literal("polyline"), points: Points }),
  v.strictObject({ ...common, type: v.literal("polygon"), points: Points, paint: Paint }),
  v.strictObject({
    ...common,
    type: v.literal("path"),
    d: v.pipe(v.string(), v.maxLength(20_000)),
    paint: Paint,
  }),
  v.strictObject({ ...common, type: v.literal("circle"), cx: Num, cy: Num, r: Num, paint: Paint }),
  v.strictObject({ ...common, type: v.literal("dot"), cx: Num, cy: Num, r: v.optional(Num) }),
  v.strictObject({
    ...common,
    type: v.literal("arc"),
    cx: Num,
    cy: Num,
    r: Num,
    start: Num,
    end: Num,
  }),
  v.strictObject({
    ...common,
    type: v.literal("ellipse"),
    cx: Num,
    cy: Num,
    rx: Num,
    ry: Num,
    paint: Paint,
  }),
  v.strictObject({
    ...common,
    type: v.literal("rect"),
    x: Num,
    y: Num,
    width: Num,
    height: Num,
    paint: Paint,
  }),
  v.strictObject({
    ...common,
    type: v.literal("star"),
    cx: Num,
    cy: Num,
    points: Count,
    outerRadius: Num,
    innerRadius: Num,
    rotation: Num,
    paint: Paint,
  }),
  v.strictObject({
    ...common,
    type: v.literal("radial"),
    count: Count,
    center: Vec,
    start: Num,
    sweep: Num,
    element: Element,
  }),
  v.strictObject({
    ...common,
    type: v.literal("repeat"),
    count: Count,
    step: v.optional(Vec),
    spread: v.optional(Vec),
    align: v.optional(v.picklist(["start", "center"])),
    element: Element,
  }),
  v.strictObject({
    ...common,
    type: v.literal("concentric"),
    count: Count,
    center: Vec,
    scaleStep: Num,
    element: Element,
  }),
  v.strictObject({
    ...common,
    type: v.literal("use"),
    shape: Id,
    params: v.optional(v.record(Id, ParamValue)),
    transform: v.optional(
      v.strictObject({
        translate: v.optional(Vec),
        scale: v.optional(Num),
        rotate: v.optional(Num),
        origin: v.optional(Vec),
      }),
    ),
  }),
]);

const KurdishName = v.looseObject({ text: v.nullable(Text), status: Text });
const Parameter = v.variant("type", [
  v.looseObject({
    type: v.literal("integer"),
    min: Int,
    max: Int,
    default: Int,
    description: Text,
  }),
  v.looseObject({ type: v.literal("boolean"), default: v.boolean(), description: Text }),
  v.looseObject({
    type: v.literal("enum"),
    values: v.pipe(v.array(Text), v.minLength(1), v.maxLength(64)),
    default: Text,
    description: Text,
  }),
]);

const ShapeDataSchema = v.looseObject({
  id: Id,
  version: v.pipe(Int, v.minValue(1)),
  category: Text,
  names: v.looseObject({ en: Text, ckb: KurdishName, kmr: KurdishName }),
  aliases: v.pipe(v.array(Text), v.maxLength(64)),
  tags: v.pipe(v.array(Text), v.maxLength(64)),
  layers: v.pipe(v.array(Id), v.minLength(1), v.maxLength(64)),
  symmetry: Text,
  parameters: v.pipe(
    v.record(Id, Parameter),
    v.check((p) => Object.keys(p).length <= 32, "at most 32 parameters"),
  ),
  primitives: v.pipe(v.array(Primitive), v.maxLength(512)),
});

/**
 * Check a shape given as data.
 *
 * @throws {DeqError} `INVALID_OPTIONS`, listing each problem with its path (`data.primitives.0.cx`).
 */
export function checkShapeData(data: unknown): ShapeData {
  const result = v.safeParse(ShapeDataSchema, data);
  if (!result.success) {
    const issues = result.issues.slice(0, 8).map((i) => {
      const path = v.getDotPath(i);
      return `data${path === null ? "" : `.${path}`}: ${i.message}`;
    });
    throw new DeqError("INVALID_OPTIONS", `invalid export item: ${issues.join("; ")}`, issues);
  }
  return data as ShapeData;
}
