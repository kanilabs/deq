/**
 * @0xdolan/deq-generator: Deq Leet text and seeded patterns of Deq motifs (ADR 0015).
 * Pure ESM, no DOM, no I/O.
 *
 * ```ts
 * import { leet, decodeLeet, pattern } from "@0xdolan/deq-generator";
 * const { svg } = leet("Deq", { level: "basic" });
 * decodeLeet(svg).text; // "DEQ"
 * pattern({ kind: "band", seed: 42 }).svg;
 * ```
 *
 * @packageDocumentation
 */
export { MAX_DECODE_INPUT, decodeLeet, leet } from "./leet.js";
export type { DecodedLeet, LeetLevel, LeetOptions, LeetResult } from "./leet.js";
export { pattern } from "./pattern.js";
export type { PatternKind, PatternOptions, PatternResult } from "./pattern.js";
export { MAX_SEED, Random } from "./random.js";
export {
  MAX_SCENE_ITEMS,
  expandGlyph,
  glyphMarkup,
  glyphShape,
  prepareScene,
  resolveSceneOptions,
  sceneSvg,
} from "./scene.js";
export type { Cell, ResolvedSceneOptions, Scene, SceneOptions } from "./scene.js";
export {
  MAX_GLYPHS,
  MAX_INPUT,
  MAX_LINES,
  detectScript,
  entryOf,
  leetTable,
  normalize,
} from "./tables.js";
export type {
  Glyph,
  GlyphPart,
  LeetEntry,
  LeetTable,
  Normalized,
  Script,
  Token,
} from "./tables.js";

/** The npm package name. */
export const packageName = "@0xdolan/deq-generator" as const;
