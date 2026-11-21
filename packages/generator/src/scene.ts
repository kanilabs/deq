/**
 * Scenes: glyphs placed on a canvas larger than one shape, written as one SVG with one
 * group (layer) per cell. Leet text and generated patterns are both scenes.
 */
import {
  DeqError,
  element,
  escapeXml,
  expandShape,
  num,
  resolveOptions,
  svgRoot,
} from "@0xdolan/deq-core";
import type { Flat, Prepared, RenderOptions, ResolvedOptions, ShapeData } from "@0xdolan/deq-core";
import * as v from "valibot";

import type { Glyph } from "./tables.js";

/** One glyph placed in a scene; the glyph's 24 x 24 cell has its top left at (x, y). */
export interface Cell {
  readonly x: number;
  readonly y: number;
  readonly glyph: Glyph;
}

/** Glyphs on a `width` x `height` canvas in grid units. */
export interface Scene {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly Cell[];
}

/**
 * Options for scene output: the render options of a single shape, except the per-shape
 * `rotation`, `flipX`, `flipY`, `params` and `layerColors`, plus `colors`.
 */
export type SceneOptions = Omit<
  RenderOptions,
  "rotation" | "flipX" | "flipY" | "params" | "layerColors"
> & {
  /** Colours given to the cells in turn (at most 16). Default: every cell uses `color`. */
  readonly colors?: readonly string[];
};

/** The most drawing elements one scene may expand to. */
export const MAX_SCENE_ITEMS = 20_000;

const SHAPE_ONLY = ["rotation", "flipX", "flipY", "params", "layerColors"] as const;
const ColorsSchema = v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(16));

/** Validated scene options. */
export interface ResolvedSceneOptions {
  readonly render: ResolvedOptions;
  readonly colors: readonly string[];
}

/**
 * Validate scene options.
 *
 * @throws {DeqError} `INVALID_OPTIONS`.
 */
export function resolveSceneOptions(options: SceneOptions = {}): ResolvedSceneOptions {
  const { colors, ...rest } = options as SceneOptions & Record<string, unknown>;
  const bad = SHAPE_ONLY.filter((k) => k in rest);
  if (bad.length > 0) {
    const issues = bad.map((k) => `${k}: not available for scenes`);
    throw new DeqError("INVALID_OPTIONS", `invalid scene options: ${issues.join("; ")}`, issues);
  }
  const render = resolveOptions(rest);
  if (colors === undefined) return { render, colors: [] };
  if (!v.is(ColorsSchema, colors)) {
    const issue = "colors: must be a list of 1 to 16 colours";
    throw new DeqError("INVALID_OPTIONS", `invalid scene options: ${issue}`, [issue]);
  }
  // Each colour goes through the same check as `color`.
  colors.forEach((c, i) => {
    try {
      resolveOptions({ color: c });
    } catch {
      const issue = `colors.${String(i)}: must be a CSS colour`;
      throw new DeqError("INVALID_OPTIONS", `invalid scene options: ${issue}`, [issue]);
    }
  });
  return { render, colors };
}

/** The shape description of a glyph: one `use` primitive per part. */
export function glyphShape(glyph: Glyph): ShapeData {
  return {
    id: "glyph",
    version: 1,
    category: "glyph",
    names: {
      en: "Glyph",
      ckb: { text: null, status: "none" },
      kmr: { text: null, status: "none" },
    },
    aliases: [],
    tags: [],
    layers: ["glyph"],
    symmetry: "none",
    parameters: {},
    primitives: glyph.map((part) => ({
      type: "use" as const,
      shape: part.shape,
      layer: "glyph",
      ...(part.params ? { params: part.params } : {}),
      ...(part.transform ? { transform: part.transform } : {}),
    })),
  };
}

/** The flat geometry of a glyph in its own 24 x 24 cell. */
export function expandGlyph(glyph: Glyph): readonly Flat[] {
  return expandShape(glyphShape(glyph), {});
}

/** The inner markup of a glyph's group, as written by {@link sceneSvg}. */
export function glyphMarkup(glyph: Glyph, o: ResolvedOptions): string {
  return expandGlyph(glyph)
    .map((item) => element(item, o))
    .join("");
}

/**
 * Write `scene` as SVG. Each cell is a `<g data-layer="cN" transform="translate(x y)">`
 * in cell order, so exporters keep one layer per glyph.
 *
 * @param title The default title (the text, for Leet).
 * @param rootAttrs Extra attributes on the root, starting with a space.
 * @throws {DeqError} `INVALID_OPTIONS`, `UNKNOWN_SHAPE`, `INVALID_PARAMETER` or
 * `LIMIT_EXCEEDED` (more than {@link MAX_SCENE_ITEMS} elements).
 */
export function sceneSvg(
  scene: Scene,
  options: SceneOptions = {},
  title = "",
  rootAttrs = "",
): string {
  const { render: o, colors } = resolveSceneOptions(options);
  const cache = new Map<string, readonly Flat[]>();
  let count = 0;
  let out = svgRoot(o, title, { rootAttrs }, scene.width, scene.height);
  scene.cells.forEach((cell, i) => {
    const key = JSON.stringify(cell.glyph);
    let items = cache.get(key);
    if (!items) {
      items = expandGlyph(cell.glyph);
      cache.set(key, items);
    }
    count += items.length;
    if (count > MAX_SCENE_ITEMS) {
      throw new DeqError(
        "LIMIT_EXCEEDED",
        `scene expands to more than ${String(MAX_SCENE_ITEMS)} elements`,
      );
    }
    const c = colors.length > 0 ? colors[i % colors.length] : undefined;
    const style = c === undefined ? "" : ` color="${escapeXml(c)}" stroke="currentColor"`;
    const inner = items.map((item) => element(item, o)).join("");
    out += `<g data-layer="c${String(i + 1)}" transform="translate(${num(cell.x)} ${num(cell.y)})"${style}>${inner}</g>`;
  });
  return `${out}</svg>`;
}

/** The glyph of `cell` moved to its place in the scene, in layer `layer`. */
function placedShape(cell: Cell, layer: string): ShapeData {
  const base = glyphShape(cell.glyph);
  return {
    ...base,
    layers: [layer],
    primitives: cell.glyph.map((part) => {
      // The translation is applied last (after scale and rotation), so the cell offset adds.
      const [dx, dy] = part.transform?.translate ?? [0, 0];
      return {
        type: "use" as const,
        shape: part.shape,
        layer,
        ...(part.params ? { params: part.params } : {}),
        transform: { ...part.transform, translate: [dx + cell.x, dy + cell.y] as const },
      };
    }),
  };
}

/**
 * Prepare `scene` for exporters: the geometry of every cell moved into place, one layer
 * `cN` per cell and `colors` as layer colours, on a `width` x `height` canvas. With no
 * colours the layers stay ungrouped, like a single shape; {@link sceneSvg} is the SVG
 * writer, this is for the other formats.
 *
 * @param title The default title.
 * @throws {DeqError} like {@link sceneSvg}.
 */
export function prepareScene(scene: Scene, options: SceneOptions = {}, title = ""): Prepared {
  const { render, colors } = resolveSceneOptions(options);
  const items: Flat[] = [];
  const layers: string[] = [];
  const layerColors: Record<string, string> = {};
  scene.cells.forEach((cell, i) => {
    const layer = `c${String(i + 1)}`;
    const flats = expandShape(placedShape(cell, layer), {});
    if (items.length + flats.length > MAX_SCENE_ITEMS) {
      throw new DeqError(
        "LIMIT_EXCEEDED",
        `scene expands to more than ${String(MAX_SCENE_ITEMS)} elements`,
      );
    }
    items.push(...flats);
    layers.push(layer);
    const c = colors.length > 0 ? colors[i % colors.length] : undefined;
    if (c !== undefined) layerColors[layer] = c;
  });
  return {
    options: { ...render, layerColors },
    items,
    layers,
    defaultTitle: title,
    width: scene.width,
    height: scene.height,
  };
}
