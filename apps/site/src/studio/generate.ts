/**
 * Deq Leet and pattern helpers for the site (Phase 9d, ADR 0017): frames of motifs round
 * Leet text, Private Use Area text for the Deq Leet font, and Studio items from a scene.
 * Pure functions over the generator's output; the generator itself is unchanged.
 */
import { DeqError, type RenderOptions } from "@0xdolan/deq-core";
import {
  leet,
  normalize,
  pattern,
  type Cell,
  type Glyph,
  type LeetOptions,
  type LeetResult,
  type Scene,
} from "@0xdolan/deq-generator";

import codepointFile from "../../../../fonts/leet-codepoints.json";
import { CUSTOM_LIMITS, newCustomId, parseCustomDef, type CustomDef } from "./custom.ts";
import { compactOptions, LIMITS, type Item, type StudioDoc } from "./model.ts";
import { nextGroupId } from "./arrange.ts";

/** How Leet text is framed. */
export type FrameKind = "none" | "band" | "border";

export interface Frame {
  readonly kind: FrameKind;
  /** Seed of the frame's pattern. */
  readonly seed: number;
  /** Catalog ids the frame picks its motifs from (default: every shape). */
  readonly motifs?: readonly string[];
}

/** Space between the text and its frame, in grid units. */
export const FRAME_GAP = 6;
/** Distance between pattern cells with the generator's default spacing of 2. */
const STEP = 26;
const MAX_BAND = 63;
const MAX_BORDER = 32;

/** Leet options without the render options (those only affect drawing). */
export type LeetLayout = Pick<
  LeetOptions,
  "level" | "script" | "seed" | "letterSpacing" | "lineSpacing" | "align"
>;

export interface Composed {
  /** The Leet text on its own; its SVG is what `decodeLeet` reads. */
  readonly result: LeetResult;
  /** The text and its frame; equal to `result.scene` without a frame. */
  readonly scene: Scene;
  /** A label per cell of `scene`: the character, or the motif id of a frame cell. */
  readonly names: readonly string[];
  readonly framed: boolean;
}

const shift = (cells: readonly Cell[], dx: number, dy: number): Cell[] =>
  cells.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));

/** The characters of the cells of `leet(input)`, in cell order. */
export function cellChars(input: string, result: LeetResult): string[] {
  return normalize(input, result.script).lines.flatMap((line) =>
    line.flatMap((t) => (t.kind === "char" ? [t.char] : [])),
  );
}

/** The smallest odd band count, at least 3, that spans `width` (capped at 63). */
export function bandCount(width: number): number {
  let n = Math.max(3, Math.ceil((width + 2) / STEP));
  if (n % 2 === 0) n += 1;
  return Math.min(n, MAX_BAND);
}

/** Border cells along one side so the inner space holds `length` plus the gaps. */
export function borderCount(length: number): number {
  return Math.max(3, Math.ceil((length + 2 * FRAME_GAP + 24) / STEP) + 1);
}

/**
 * Write `input` in Leet and frame it: `band` puts a band of motifs above and below the
 * text, `border` draws a border round it. The frame comes from the generator's `pattern`.
 *
 * @throws {DeqError} like `leet` and `pattern`; `LIMIT_EXCEEDED` when the text is too large
 * for a border (more than 32 cells a side).
 */
export function composeLeet(input: string, layout: LeetLayout, frame: Frame): Composed {
  const result = leet(input, layout);
  const text = result.scene;
  const chars = cellChars(input, result);
  if (frame.kind === "none") return { result, scene: text, names: chars, framed: false };
  const base = { seed: frame.seed, ...(frame.motifs ? { motifs: frame.motifs } : {}) };
  if (frame.kind === "band") {
    const band = pattern({ ...base, kind: "band", count: bandCount(text.width) });
    const motifs = band.scene.cells.map((c) => c.glyph[0]?.shape ?? "");
    const width = Math.max(band.scene.width, text.width);
    const bx = (width - band.scene.width) / 2;
    const ty = 24 + FRAME_GAP;
    const by = ty + text.height + FRAME_GAP;
    const cells = [
      ...shift(text.cells, (width - text.width) / 2, ty),
      ...shift(band.scene.cells, bx, 0),
      ...shift(band.scene.cells, bx, by),
    ];
    return {
      result,
      scene: { width, height: by + 24, cells },
      names: [...chars, ...motifs, ...motifs],
      framed: true,
    };
  }
  const cols = borderCount(text.width);
  const rows = borderCount(text.height);
  if (cols > MAX_BORDER || rows > MAX_BORDER) {
    throw new DeqError("LIMIT_EXCEEDED", "the text is too large for a border");
  }
  const border = pattern({ ...base, kind: "border", cols, rows });
  const { width, height } = border.scene;
  const cells = [
    ...shift(text.cells, (width - text.width) / 2, (height - text.height) / 2),
    ...border.scene.cells,
  ];
  const motifs = border.scene.cells.map((c) => c.glyph[0]?.shape ?? "");
  return { result, scene: { width, height, cells }, names: [...chars, ...motifs], framed: true };
}

// Private Use Area text --------------------------------------------------------------------

interface Points {
  readonly basic: string;
  readonly advanced: readonly string[];
  readonly full: string;
}
const CODEPOINTS = codepointFile.codepoints as Readonly<
  Record<"latin" | "sorani", Readonly<Record<string, Points>>>
>;

const same = (a: Glyph, b: Glyph): boolean => JSON.stringify(a) === JSON.stringify(b);
const char = (hex: string): string => String.fromCodePoint(Number.parseInt(hex, 16));

/**
 * The Leet text as Deq Leet font code points (PUA from U+F000, ADR 0016): each glyph's
 * own code point, so `advanced` and `full` text keeps its glyphs. Private-use characters
 * run left to right, so Sorani lines are written in visual order. Screen readers cannot
 * read the result; show it with the plain text as its label.
 */
export function puaText(input: string, result: LeetResult): string {
  const table = CODEPOINTS[result.script];
  const cells = result.scene.cells;
  let at = 0;
  const lines = normalize(input, result.script).lines.map((line) => {
    const out = line.map((token) => {
      if (token.kind === "space") return " ";
      const glyph = cells[at]?.glyph ?? [];
      at += 1;
      const points = table[token.char];
      if (!points) return "";
      const { entry } = token;
      if (same(glyph, entry.basic)) return char(points.basic);
      const i = entry.advanced.findIndex((g) => same(g, glyph));
      const hex = i >= 0 ? points.advanced[i] : points.full;
      return hex ? char(hex) : "";
    });
    return (result.script === "sorani" ? out.reverse() : out).join("");
  });
  return lines.join("\n");
}

// Studio items --------------------------------------------------------------------------------

/** Render options a scene passes to every inserted item. */
export const ITEM_OPTION_KEYS = [
  "color",
  "strokeWidth",
  "absoluteStrokeWidth",
  "fill",
  "fillOpacity",
  "strokeOpacity",
  "linecap",
  "linejoin",
  "dotScale",
] as const satisfies readonly (keyof RenderOptions)[];

export interface InsertOptions {
  /** Pixel size of one 24-unit cell. */
  readonly size: number;
  /** Canvas position of the scene's top left corner, in px. */
  readonly x: number;
  readonly y: number;
  /** Render options for every item (only {@link ITEM_OPTION_KEYS} are used). */
  readonly options?: RenderOptions;
  /** Colours given to the cells in turn. */
  readonly colors?: readonly string[];
  /** Item names per cell (Leet characters); motifs keep their shape names. */
  readonly names?: readonly (string | undefined)[];
  /** Custom shape names per cell, for glyphs of several shapes. */
  readonly shapeNames?: readonly (string | undefined)[];
}

/** Why a scene does not fit the design. */
export class InsertError extends Error {
  override name = "InsertError";
  constructor(readonly limit: "items" | "shapes") {
    super(`the design has no room for these ${limit}`);
  }
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Add `scene` to `doc` as one group of editable items. A glyph of one shape becomes a
 * catalog item (its scale and rotation moved into size and rotation, with the stroke and
 * dots kept at the scene's width, since core never scales those inside a glyph); a glyph
 * of several shapes becomes a custom shape embedded in the design.
 *
 * @throws {InsertError} when the design would go over its item or custom shape limits.
 */
export function insertScene(
  doc: StudioDoc,
  scene: Scene,
  insert: InsertOptions,
  newId: () => string = () => newCustomId(),
): { doc: StudioDoc; ids: string[] } {
  if (doc.items.length + scene.cells.length > LIMITS.items) throw new InsertError("items");
  const k = insert.size / 24;
  const base: Record<string, unknown> = {};
  for (const key of ITEM_OPTION_KEYS) {
    if (insert.options?.[key] !== undefined) base[key] = insert.options[key];
  }
  const strokeWidth = insert.options?.strokeWidth ?? 2;
  const dotScale = insert.options?.dotScale ?? 1;
  const group = nextGroupId(doc.items);
  const grouped = scene.cells.length > 1;
  const used = new Set(doc.items.map((i) => i.id));
  let n = 0;
  const id = (): string => {
    do n += 1;
    while (used.has(`i${String(n)}`));
    return `i${String(n)}`;
  };
  const defs = new Map<string, CustomDef>();
  const items: Item[] = scene.cells.map((cell, i) => {
    const color = insert.colors?.length ? insert.colors[i % insert.colors.length] : undefined;
    const name = insert.names?.[i];
    const common = { id: id(), ...(grouped ? { group } : {}), ...(name ? { name } : {}) };
    const [only] = cell.glyph;
    if (only && cell.glyph.length === 1) {
      const s = only.transform?.scale ?? 1;
      const [tx, ty] = only.transform?.translate ?? [0, 0];
      const options: Record<string, unknown> = { ...base, size: round(insert.size * s) };
      if (color) options["color"] = color;
      if (only.transform?.rotate) options["rotation"] = only.transform.rotate;
      if (only.params) options["params"] = only.params;
      if (s !== 1) {
        if (!insert.options?.absoluteStrokeWidth) options["strokeWidth"] = round(strokeWidth / s);
        options["dotScale"] = round(dotScale / s);
      }
      return {
        ...common,
        shape: only.shape,
        x: round(insert.x + (cell.x + 12 + tx - 12 * s) * k),
        y: round(insert.y + (cell.y + 12 + ty - 12 * s) * k),
        options: compactOptions(options),
      };
    }
    const key = JSON.stringify(cell.glyph);
    let def = defs.get(key);
    if (!def) {
      def = parseCustomDef({
        id: newId(),
        version: 1,
        name: insert.shapeNames?.[i] ?? name ?? "Leet glyph",
        primitives: cell.glyph.map((part) => ({
          type: "use",
          shape: part.shape,
          ...(part.params ? { params: part.params } : {}),
          ...(part.transform ? { transform: part.transform } : {}),
        })),
      });
      defs.set(key, def);
    }
    const options: Record<string, unknown> = { ...base, size: round(insert.size) };
    if (color) options["color"] = color;
    return {
      ...common,
      shape: def.id,
      x: round(insert.x + cell.x * k),
      y: round(insert.y + cell.y * k),
      options: compactOptions(options),
    };
  });
  const shapes = [...(doc.shapes ?? []), ...defs.values()];
  if (shapes.length > CUSTOM_LIMITS.shapes) throw new InsertError("shapes");
  const next: StudioDoc = {
    ...doc,
    items: [...doc.items, ...items],
    ...(shapes.length > 0 ? { shapes } : {}),
  };
  return { doc: next, ids: items.map((i) => i.id) };
}

// Style ---------------------------------------------------------------------------------------

/** The flag colours (spec/flag.json) given to cells in turn by the `flag` colour mode. */
export const FLAG_COLORS = ["#ed2024", "#febd11", "#278e43"] as const;

/** The style controls the Leet and pattern panels share. */
export interface SceneStyle {
  /** Pixel size of one 24-unit cell. */
  readonly size: number;
  readonly strokeWidth: number;
  /** `theme` draws in the text colour (`currentColor`). */
  readonly colorMode: "theme" | "custom" | "flag";
  readonly color: string;
  /** Empty for a transparent background. */
  readonly background: string;
}

export const DEFAULT_STYLE: SceneStyle = {
  size: 48,
  strokeWidth: 2,
  colorMode: "theme",
  color: "#ed2024",
  background: "",
};

/** Scene render options for a style. */
export function styleOptions(style: SceneStyle): {
  size: number;
  strokeWidth: number;
  color?: string;
  colors?: readonly string[];
  background?: string;
} {
  return {
    size: style.size,
    strokeWidth: style.strokeWidth,
    ...(style.colorMode === "custom" ? { color: style.color } : {}),
    ...(style.colorMode === "flag" ? { colors: FLAG_COLORS } : {}),
    ...(style.background ? { background: style.background } : {}),
  };
}
