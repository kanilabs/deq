/**
 * Export inputs: catalog shapes, compositions, shape data (for example custom shapes from
 * Studio) or scenes (Deq Leet text and generated patterns), plus the files exporters produce.
 */
import { CANVAS, DeqError, composeShape, getShape, prepare } from "@0xdolan/deq-core";
import { MAX_SCENE_ITEMS, leet, pattern, prepareScene, sceneSvg } from "@0xdolan/deq-generator";
import type { LeetOptions, PatternOptions, Scene, SceneOptions } from "@0xdolan/deq-generator";
import * as v from "valibot";
import type {
  CompositionPart,
  ParamValue,
  Prepared,
  RenderOptions,
  ShapeData,
} from "@0xdolan/deq-core";

import { KEBAB, checkShapeData } from "./shape-data.js";

/** One catalog shape, with optional parameters and render options. */
export interface ShapeItem {
  /** Catalog shape id, for example `roj-half-sun`. */
  readonly shape: string;
  /** Shape parameter values; merged over `options.params`. */
  readonly params?: Readonly<Record<string, ParamValue>>;
  /** Render options for this item; merged over the exporter's `render` options. */
  readonly options?: RenderOptions;
  /** Base file name (kebab case). Default: the shape id. */
  readonly name?: string;
}

/** Several catalog shapes on one canvas, one layer per part (see `compose` in core). */
export interface CompositionItem {
  readonly parts: readonly CompositionPart[];
  readonly options?: RenderOptions;
  /** Base file name (kebab case). Default: `composition`. */
  readonly name?: string;
}

/**
 * A shape given as data instead of a catalog id: a custom shape in the spec format, as
 * core's `renderShapeData` reads it. Its primitives may `use` catalog shapes. The top level
 * is checked against the full primitive schema first (see `checkShapeData`), and core
 * enforces its expansion limits while rendering.
 */
export interface DataItem {
  readonly data: ShapeData;
  /** Shape parameter values; merged over `options.params`. */
  readonly params?: Readonly<Record<string, ParamValue>>;
  readonly options?: RenderOptions;
  /** Base file name (kebab case). Default: the shape's id. */
  readonly name?: string;
}

/**
 * Deq Leet text as one wide scene with one layer per character (see `leet` in
 * `@0xdolan/deq-generator`). The exporter's render options apply except the per-shape
 * ones (`rotation`, `flipX`, `flipY`, `params`, `layerColors`).
 */
export interface LeetItem {
  readonly leet: string;
  readonly options?: LeetOptions;
  /** Base file name (kebab case). Default: `deq-leet`. */
  readonly name?: string;
}

/** A seeded pattern of motifs as one scene with one layer per motif (see `pattern`). */
export interface PatternItem {
  readonly pattern: PatternOptions;
  /** Base file name (kebab case). Default: `deq-<kind>` (`deq-band` without a kind). */
  readonly name?: string;
}

/**
 * A scene built by the caller from generator output, for example Leet text framed by a
 * pattern in the website. Cells place glyphs of catalog shapes; the scene is checked
 * against a strict schema and core's expansion limits.
 */
export interface SceneItem {
  readonly scene: Scene;
  readonly options?: SceneOptions;
  /** The default title. Default: empty (the SVG is decorative unless options set one). */
  readonly title?: string;
  /** Base file name (kebab case). Default: `deq-scene`. */
  readonly name?: string;
}

/**
 * What every exporter accepts: a shape id, a {@link ShapeItem}, a {@link CompositionItem},
 * a {@link DataItem}, a {@link LeetItem}, a {@link PatternItem} or a {@link SceneItem}.
 */
export type ExportItem =
  string | ShapeItem | CompositionItem | DataItem | LeetItem | PatternItem | SceneItem;

/** One output file. Text formats return a string, binary formats a `Uint8Array`. */
export interface ExportFile {
  /** File name with extension, for example `kurdish-sun.pdf`. Never contains a path. */
  readonly name: string;
  /** IANA media type. */
  readonly mediaType: string;
  readonly data: string | Uint8Array;
}

/** An item resolved into a shape description, its render options and its geometry. */
export interface Resolved {
  /** Safe base file name. */
  readonly name: string;
  readonly shape: ShapeData;
  /** The merged render options (unresolved, so a format can override some of them). */
  readonly options: RenderOptions;
  readonly prepared: Prepared;
  /**
   * For scenes (Leet and patterns): the generator's own SVG, which SVG-based formats
   * return unchanged so the output stays decodable. `prepared` has the same geometry, one
   * layer per cell, for the other formats.
   */
  readonly scene?: string;
}

/**
 * The size in pixels of prepared geometry, as core writes it on the root `<svg>`: `size`
 * for each 24-unit side, more for the long side of a scene.
 */
export function canvasPixels(p: Prepared): { readonly width: number; readonly height: number } {
  const o = p.options;
  const box = CANVAS + 2 * o.padding;
  const side = (n: number | undefined): number =>
    n === undefined || n === CANVAS ? o.size : (o.size * (n + 2 * o.padding)) / box;
  return { width: side(p.width), height: side(p.height) };
}

/** Formats that need a square, single-shape canvas and refuse scenes. */
export const SCENE_UNSUPPORTED = ["svg-sprite", "ico", "favicon", "figma", "spec-json"] as const;

const SHAPE_ONLY = new Set(["rotation", "flipX", "flipY", "params", "layerColors"]);
const LEET_ONLY = new Set(["level", "script", "seed", "letterSpacing", "lineSpacing", "align"]);
const PATTERN_ONLY = new Set([
  "kind",
  "seed",
  "motifs",
  "count",
  "cols",
  "rows",
  "petals",
  "spacing",
]);

/** `o` without the keys in `drop`. */
const omit = (o: object, drop: ReadonlySet<string>): RenderOptions =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !drop.has(k)));

/** Render options without the per-shape ones, as scene defaults. */
function sceneDefaults(defaults: RenderOptions): RenderOptions {
  return omit(defaults, SHAPE_ONLY);
}

/** A shape description that stands for a scene: its layers and title, no primitives. */
function sceneShape(name: string, title: string, layers: readonly string[]): ShapeData {
  return {
    id: name,
    version: 1,
    category: "scene",
    names: {
      en: title,
      ckb: { text: null, status: "none" },
      kmr: { text: null, status: "none" },
    },
    aliases: [],
    tags: [],
    layers: [...layers],
    symmetry: "none",
    parameters: {},
    primitives: [],
  };
}

const finite = v.pipe(v.number(), v.finite());
const coord = v.pipe(finite, v.minValue(-100_000), v.maxValue(100_000));
const SceneSchema = v.strictObject({
  width: v.pipe(finite, v.gtValue(0), v.maxValue(100_000)),
  height: v.pipe(finite, v.gtValue(0), v.maxValue(100_000)),
  cells: v.pipe(
    v.array(
      v.strictObject({
        x: coord,
        y: coord,
        glyph: v.pipe(
          v.array(
            v.strictObject({
              shape: v.pipe(v.string(), v.maxLength(64), v.regex(KEBAB)),
              params: v.optional(
                v.record(v.string(), v.union([v.number(), v.boolean(), v.string()])),
              ),
              transform: v.optional(
                v.strictObject({
                  translate: v.optional(v.tuple([coord, coord])),
                  scale: v.optional(v.pipe(finite, v.gtValue(0), v.maxValue(4))),
                  rotate: v.optional(v.pipe(finite, v.minValue(-360), v.maxValue(360))),
                }),
              ),
            }),
          ),
          v.minLength(1),
          v.maxLength(16),
        ),
      }),
    ),
    v.maxLength(MAX_SCENE_ITEMS),
  ),
});

function checkScene(scene: unknown): Scene {
  const r = v.safeParse(SceneSchema, scene);
  if (!r.success) {
    const issue = r.issues[0];
    const path = issue.path?.map((p) => String(p.key)).join(".") ?? "";
    const msg = `scene${path ? `.${path}` : ""}: ${issue.message}`;
    throw new DeqError("INVALID_OPTIONS", `invalid export item: ${msg}`, [msg]);
  }
  return r.output as Scene;
}

function resolveScene(item: LeetItem | PatternItem | SceneItem, defaults: RenderOptions): Resolved {
  const base = sceneDefaults(defaults);
  let name: string;
  let svg: string;
  let prepared: Prepared;
  let options: RenderOptions;
  if ("scene" in item) {
    const scene = checkScene(item.scene);
    const merged = { ...base, ...item.options } as SceneOptions;
    const title = item.title ?? "";
    name = checkName(item.name ?? "deq-scene");
    svg = sceneSvg(scene, merged, title);
    prepared = prepareScene(scene, merged, title);
    options = merged;
  } else if ("leet" in item) {
    const merged = { ...base, ...item.options } as LeetOptions;
    const r = leet(item.leet, merged);
    name = checkName(item.name ?? "deq-leet");
    svg = r.svg;
    prepared = prepareScene(r.scene, omit(merged, LEET_ONLY), r.text.replace(/\n/gu, " "));
    options = merged;
  } else {
    const merged = { ...base, ...item.pattern } as PatternOptions;
    const r = pattern(merged);
    name = checkName(item.name ?? `deq-${merged.kind ?? "band"}`);
    svg = r.svg;
    const title = `Deq ${merged.kind ?? "band"} pattern`;
    prepared = prepareScene(r.scene, omit(merged, PATTERN_ONLY), title);
    options = merged;
  }
  const shape = sceneShape(name, prepared.defaultTitle, prepared.layers);
  return { name, shape, options, prepared, scene: svg };
}
const NAME = KEBAB;
/** Most items one export call accepts. */
export const MAX_ITEMS = 512;

function checkName(name: string): string {
  if (name.length > 64 || !NAME.test(name)) {
    const issue = `name: must be kebab case, at most 64 characters (got ${JSON.stringify(name.slice(0, 80))})`;
    throw new DeqError("INVALID_OPTIONS", `invalid export item: ${issue}`, [issue]);
  }
  return name;
}

/**
 * Resolve one item. `defaults` are the exporter's render options; the item's own options
 * and parameters win.
 *
 * @throws {DeqError} for unknown shapes, bad names, options or parameters.
 */
export function resolveItem(item: ExportItem, defaults: RenderOptions = {}): Resolved {
  if (typeof item === "string") return resolveItem({ shape: item }, defaults);
  if ("leet" in item || "pattern" in item || "scene" in item) return resolveScene(item, defaults);
  if ("parts" in item) {
    const shape = composeShape(item.parts);
    const options: RenderOptions = { ...defaults, ...item.options, params: {} };
    const name = checkName(item.name ?? "composition");
    return { name, shape, options, prepared: prepare(shape, options) };
  }
  const shape = "data" in item ? checkShapeData(item.data) : getShape(item.shape);
  const params = { ...defaults.params, ...item.options?.params, ...item.params };
  const options: RenderOptions = { ...defaults, ...item.options, params };
  const name = checkName(item.name ?? shape.id);
  return { name, shape, options, prepared: prepare(shape, options) };
}

/**
 * Resolve a list of items, rejecting empty lists, more than {@link MAX_ITEMS} items and
 * duplicate file names.
 */
export function resolveItems(
  items: readonly ExportItem[],
  defaults: RenderOptions = {},
): Resolved[] {
  if (items.length === 0 || items.length > MAX_ITEMS) {
    const issue = `items: give 1 to ${String(MAX_ITEMS)} items (got ${String(items.length)})`;
    throw new DeqError("INVALID_OPTIONS", `invalid export: ${issue}`, [issue]);
  }
  const out = items.map((i) => resolveItem(i, defaults));
  const seen = new Set<string>();
  for (const r of out) {
    if (seen.has(r.name)) {
      const issue = `items: duplicate name ${r.name}; give each item a unique \`name\``;
      throw new DeqError("INVALID_OPTIONS", `invalid export: ${issue}`, [issue]);
    }
    seen.add(r.name);
  }
  return out;
}
