/**
 * The Studio document: shapes placed on an infinite canvas, each with its own render
 * options (PRD §8.1, §8.5). Framework-free so it can be unit-tested and reused by the
 * share-URL and export code. Every document that enters the Studio (local autosave,
 * shared links, imports) goes through {@link parseDoc}.
 */
import { DEFAULT_OPTIONS, hasShape, prepare, type RenderOptions } from "@0xdolan/deq-core";
import * as v from "valibot";

import { isCustomId, parseCustomDefs, toShapeData, type CustomDef } from "./custom.ts";
import { shapeOf } from "./shapes.ts";

/** Render options a Studio item can carry. `title`/`ariaLabel` come from the item name. */
export type ItemOptions = Omit<RenderOptions, "title" | "ariaLabel">;

/** A shape on the canvas. `x`/`y` is the top-left corner in canvas px; the box is `size` px. */
export interface Item {
  readonly id: string;
  readonly shape: string;
  readonly x: number;
  readonly y: number;
  /** Only options that differ from the defaults are stored. */
  readonly options: ItemOptions;
  readonly name?: string;
  readonly locked?: boolean;
  readonly hidden?: boolean;
  /** Items with the same group id select and move together (Phase 8b). */
  readonly group?: string;
}

export interface StudioDoc {
  readonly v: 1;
  readonly items: readonly Item[];
  /** The custom shapes the items use (Phase 8c), so a design renders anywhere. */
  readonly shapes?: readonly CustomDef[];
}

/** Hard caps for untrusted documents (shared links, local storage). */
export const LIMITS = { items: 500, coordinate: 1_000_000, name: 80 } as const;

/** MIME type used to drag a shape id from the library onto the canvas. */
export const DRAG_TYPE = "application/x-deq-shape";

export const EMPTY_DOC: StudioDoc = { v: 1, items: [] };

/** Option keys the inspector edits, in display order. */
export const OPTION_KEYS = [
  "size",
  "color",
  "strokeWidth",
  "absoluteStrokeWidth",
  "fill",
  "fillOpacity",
  "strokeOpacity",
  "linecap",
  "linejoin",
  "dotScale",
  "rotation",
  "flipX",
  "flipY",
  "padding",
  "background",
] as const satisfies readonly (keyof ItemOptions)[];
export type OptionKey = (typeof OPTION_KEYS)[number];

const coord = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(-LIMITS.coordinate),
  v.maxValue(LIMITS.coordinate),
);
const ItemSchema = v.strictObject({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9]{1,16}$/u)),
  shape: v.pipe(
    v.string(),
    v.maxLength(64),
    v.check((id) => hasShape(id) || isCustomId(id), "unknown shape"),
  ),
  x: coord,
  y: coord,
  // Shape-specific checks (layers, parameters) run in parseDoc through core's prepare().
  options: v.record(v.string(), v.unknown()),
  name: v.optional(v.pipe(v.string(), v.maxLength(LIMITS.name))),
  locked: v.optional(v.boolean()),
  hidden: v.optional(v.boolean()),
  group: v.optional(v.pipe(v.string(), v.regex(/^g[0-9]{1,6}$/u))),
});
const DocSchema = v.strictObject({
  v: v.literal(1),
  items: v.pipe(v.array(ItemSchema), v.maxLength(LIMITS.items)),
  // Checked by parseCustomDefs (schema plus core's expansion limits).
  shapes: v.optional(v.unknown()),
});

/** Why a document was rejected. */
export class DocError extends Error {
  override name = "DocError";
}

/**
 * Validate an untrusted value as a Studio document. Item options are checked by core's
 * own validation for that item's shape, so the Studio accepts exactly what the renderer
 * accepts.
 *
 * @throws {DocError} with the first problem found.
 */
export function parseDoc(value: unknown): StudioDoc {
  const result = v.safeParse(DocSchema, value);
  if (!result.success) {
    const issue = result.issues[0];
    const path = issue.path?.map((p) => String(p.key)).join(".") ?? "";
    throw new DocError(`invalid design: ${path ? `${path}: ` : ""}${issue.message}`);
  }
  let shapes: CustomDef[];
  try {
    shapes = result.output.shapes === undefined ? [] : parseCustomDefs(result.output.shapes);
  } catch (error) {
    throw new DocError(`invalid design: ${(error as Error).message}`);
  }
  const defs = new Map(shapes.map((d) => [d.id, d]));
  const ids = new Set<string>();
  const items = result.output.items.map((raw, i): Item => {
    if (ids.has(raw.id)) throw new DocError(`invalid design: items.${String(i)}.id: duplicate id`);
    ids.add(raw.id);
    const options = raw.options as ItemOptions;
    if ("title" in options || "ariaLabel" in options)
      throw new DocError(
        `invalid design: items.${String(i)}.options: title and ariaLabel are not allowed`,
      );
    const def = defs.get(raw.shape);
    if (isCustomId(raw.shape) && !def)
      throw new DocError(`invalid design: items.${String(i)}.shape: missing custom shape`);
    try {
      prepare(def ? toShapeData(def) : shapeOf(raw.shape), options);
    } catch (error) {
      throw new DocError(`invalid design: items.${String(i)}.options: ${(error as Error).message}`);
    }
    return {
      id: raw.id,
      shape: raw.shape,
      x: raw.x,
      y: raw.y,
      options: compactOptions(options),
      ...(raw.name ? { name: raw.name } : {}),
      ...(raw.locked ? { locked: true } : {}),
      ...(raw.hidden ? { hidden: true } : {}),
      ...(raw.group ? { group: raw.group } : {}),
    };
  });
  const used = new Set(items.map((i) => i.shape));
  const kept = shapes.filter((d) => used.has(d.id));
  return kept.length > 0 ? { v: 1, items, shapes: kept } : { v: 1, items };
}

/**
 * Embed exactly the custom shapes the items use: keep the design's own copies, take
 * missing ones from `lookup` (the library) and drop unused ones. Returns `doc` itself
 * when nothing changes.
 */
export function embedShapes(
  doc: StudioDoc,
  lookup: (id: string) => CustomDef | undefined,
): StudioDoc {
  const have = new Map((doc.shapes ?? []).map((d) => [d.id, d]));
  const used = [...new Set(doc.items.map((i) => i.shape).filter(isCustomId))];
  const shapes = used.flatMap((id) => {
    const def = have.get(id) ?? lookup(id);
    return def ? [def] : [];
  });
  const old = doc.shapes ?? [];
  if (shapes.length === old.length && shapes.every((d, i) => d === old[i])) return doc;
  return shapes.length > 0 ? { ...doc, shapes } : omit(doc, "shapes");
}

/** Drop options equal to their defaults (and empty maps) so documents stay small. */
export function compactOptions(options: ItemOptions): ItemOptions {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if ((value as unknown) === undefined) continue;
    if (key === "params" || key === "layerColors") {
      if (Object.keys(value as object).length > 0) out[key] = value;
      continue;
    }
    if (DEFAULT_OPTIONS[key as keyof typeof DEFAULT_OPTIONS] === value) continue;
    out[key] = value;
  }
  return out;
}

/** The effective value of an option for an item (stored value or default). */
export function optionValue<K extends OptionKey>(item: Item, key: K): NonNullable<ItemOptions[K]> {
  return item.options[key] ?? DEFAULT_OPTIONS[key];
}

/** Render options for an item; the name becomes the accessible title. */
export function renderOptions(item: Item, extra: RenderOptions = {}): RenderOptions {
  return { ...item.options, title: item.name ?? shapeOf(item.shape).names.en, ...extra };
}

/** The smallest id not used in `doc`: `i1`, `i2`, ... */
export function nextId(doc: StudioDoc): string {
  const used = new Set(doc.items.map((i) => i.id));
  let n = doc.items.length + 1;
  for (let k = 1; k <= n; k++) {
    if (!used.has(`i${String(k)}`)) {
      n = k;
      break;
    }
  }
  return `i${String(n)}`;
}

/** Axis-aligned box of an item in canvas px. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function itemBox(item: Item): Box {
  const s = optionValue(item, "size");
  return { x: item.x, y: item.y, w: s, h: s };
}

/** A copy of `obj` without `key`. */
export function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)) as Omit<T, K>;
}
