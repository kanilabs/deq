/** Deq Leet: text written with Deq glyphs, and decoding of `basic` output (ADR 0015). */
import { DeqError, num } from "@0xdolan/deq-core";
import * as v from "valibot";

import { Random, MAX_SEED } from "./random.js";
import { glyphMarkup, resolveSceneOptions, sceneSvg } from "./scene.js";
import type { Cell, Scene, SceneOptions } from "./scene.js";
import { MAX_GLYPHS, MAX_LINES, detectScript, leetTable, normalize } from "./tables.js";
import type { Glyph, LeetEntry, Script } from "./tables.js";

/** How much a text is transformed. */
export type LeetLevel = "basic" | "advanced" | "full";

/** Options of {@link leet}; the render options apply to the whole text. */
export type LeetOptions = SceneOptions & {
  /** Default `basic`: one readable glyph per character, which {@link decodeLeet} reads back. */
  readonly level?: LeetLevel;
  /** Default: Sorani when the text has Arabic-script letters, else Latin. */
  readonly script?: Script;
  /** Seed for the alternatives of the `advanced` level (unsigned 32-bit). Default 1. */
  readonly seed?: number;
  /** Space between glyphs in grid units (0..24). Default 2. */
  readonly letterSpacing?: number;
  /** Space between lines in grid units (0..48). Default 6. */
  readonly lineSpacing?: number;
  /** Line alignment; `start` is the left for Latin and the right for Sorani. Default `start`. */
  readonly align?: "start" | "center" | "end";
};

/** The result of {@link leet}. */
export interface LeetResult {
  /** The SVG document, one `<g data-layer="cN">` per glyph in reading order. */
  readonly svg: string;
  /** The normalised text that was drawn. */
  readonly text: string;
  readonly script: Script;
  readonly level: LeetLevel;
  /** Input characters with no glyph, in first-seen order (they are left out). */
  readonly unknown: readonly string[];
  /** The placed glyphs. */
  readonly scene: Scene;
}

const LeetSchema = v.object({
  level: v.optional(v.picklist(["basic", "advanced", "full"])),
  script: v.optional(v.picklist(["latin", "sorani"])),
  seed: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_SEED))),
  letterSpacing: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(24))),
  lineSpacing: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(48))),
  align: v.optional(v.picklist(["start", "center", "end"])),
});

function invalid(issues: readonly v.BaseIssue<unknown>[], what: string): DeqError {
  const lines = issues.map((issue) => {
    const path = (issue.path ?? []).map((p) => String(p.key)).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return new DeqError("INVALID_OPTIONS", `invalid ${what}: ${lines.join("; ")}`, lines);
}

function glyphFor(entry: LeetEntry, level: LeetLevel, random: Random): Glyph {
  if (level === "basic") return entry.basic;
  if (level === "full") return entry.full;
  return random.pick([entry.basic, ...entry.advanced]);
}

/**
 * Write `text` with Deq glyphs. The input is plain text: it is length-capped, normalised
 * (NFC, upper case, aliases) and never parsed as markup. Characters without a glyph are
 * left out and listed in `unknown`; Sorani lines run right to left.
 *
 * ```ts
 * leet("Deq", { level: "advanced", seed: 42 }).svg;
 * ```
 *
 * @throws {DeqError} `INVALID_OPTIONS` (also when nothing is left to draw) or
 * `LIMIT_EXCEEDED`.
 */
export function leet(text: string, options: LeetOptions = {}): LeetResult {
  if (typeof text !== "string") {
    throw new DeqError("INVALID_OPTIONS", "text must be a string", ["text: must be a string"]);
  }
  const { level, script, seed, letterSpacing, lineSpacing, align, ...scene } = options;
  const parsed = v.safeParse(LeetSchema, {
    level,
    script,
    seed,
    letterSpacing,
    lineSpacing,
    align,
  });
  if (!parsed.success) throw invalid(parsed.issues, "leet options");
  resolveSceneOptions(scene);
  const lvl = level ?? "basic";
  const sc = script ?? detectScript(text);
  const table = leetTable(sc);
  const norm = normalize(text, sc);
  if (norm.lines.every((line) => line.length === 0)) {
    const issue = `text: no characters of the ${sc} table`;
    throw new DeqError("INVALID_OPTIONS", `invalid text: ${issue}`, [issue]);
  }
  const ls = letterSpacing ?? 2;
  const ax = 24 + ls;
  const lh = lineSpacing ?? 6;
  const ay = 24 + lh;
  const rtl = table.direction === "rtl";
  const cols = Math.max(...norm.lines.map((line) => line.length));
  const width = cols * ax - ls;
  const height = norm.lines.length * ay - lh;
  const random = new Random(seed ?? 1);
  const cells: Cell[] = [];
  norm.lines.forEach((line, row) => {
    const free = width - (line.length * ax - ls);
    const at = align ?? "start";
    // The offset of the line's leftmost cell.
    const left = at === "center" ? free / 2 : (at === "end") !== rtl ? free : 0;
    line.forEach((token, col) => {
      if (token.kind !== "char") return;
      const x = left + (rtl ? line.length - 1 - col : col) * ax;
      cells.push({ x, y: row * ay, glyph: glyphFor(token.entry, lvl, random) });
    });
  });
  const placed: Scene = { width, height, cells };
  const meta = ` data-deq-leet="${sc} ${lvl} ${num(ax)} ${num(ay)}"`;
  const svg = sceneSvg(placed, scene, norm.text.replace(/\n/gu, " "), meta);
  return { svg, text: norm.text, script: sc, level: lvl, unknown: norm.unknown, scene: placed };
}

/** The result of {@link decodeLeet}. */
export interface DecodedLeet {
  /** The text; glyphs that are not basic glyphs read as U+FFFD. */
  readonly text: string;
  readonly script: Script;
  /** How many glyph groups were not basic glyphs of the table. */
  readonly unmatched: number;
}

/** Largest SVG {@link decodeLeet} reads, in UTF-16 code units. */
export const MAX_DECODE_INPUT = 4 * 1024 * 1024;

const NUM = "[0-9]+(?:\\.[0-9]+)?";
const META = new RegExp(
  `^<svg [^>]*?data-deq-leet="(latin|sorani) (basic|advanced|full) (${NUM}) (${NUM})"`,
  "u",
);
const GROUP = new RegExp(
  `<g data-layer="c[0-9]+" transform="translate\\((-?${NUM}) (-?${NUM})\\)"(?: color="[^"<>]*" stroke="currentColor")?>([^]*?)</g>`,
  "gu",
);

/**
 * Read the text back from Leet SVG written by {@link leet} at the `basic` level. Each
 * glyph group is matched against the table's basic glyphs rendered with `options`, which
 * must be the render options used to write it (default options by default). The SVG is
 * treated as text and only matched against what {@link leet} writes.
 *
 * @throws {DeqError} `INVALID_OPTIONS` when the input is not Deq Leet SVG, or
 * `LIMIT_EXCEEDED` (input over {@link MAX_DECODE_INPUT}, more than {@link MAX_GLYPHS} glyphs).
 */
export function decodeLeet(svg: string, options: SceneOptions = {}): DecodedLeet {
  if (typeof svg !== "string" || svg.length > MAX_DECODE_INPUT) {
    throw new DeqError(
      "LIMIT_EXCEEDED",
      `SVG is larger than ${String(MAX_DECODE_INPUT)} characters`,
    );
  }
  const meta = META.exec(svg.trimStart());
  if (!meta) {
    const issue = "svg: not Deq Leet SVG (no data-deq-leet attribute)";
    throw new DeqError("INVALID_OPTIONS", `invalid input: ${issue}`, [issue]);
  }
  const script = meta[1] === "sorani" ? "sorani" : "latin";
  const ax = Number(meta[3]);
  const ay = Number(meta[4]);
  // The advances leet() can write: 24 plus the letter (0..24) or line (0..48) spacing.
  if (ax < 24 || ax > 48 || ay < 24 || ay > 72) {
    const issue = "svg: data-deq-leet advances out of range";
    throw new DeqError("INVALID_OPTIONS", `invalid input: ${issue}`, [issue]);
  }
  const o = resolveSceneOptions(options).render;
  const byMarkup = new Map<string, string>();
  for (const entry of leetTable(script).glyphs)
    byMarkup.set(glyphMarkup(entry.basic, o), entry.char);
  let text = "";
  let unmatched = 0;
  let glyphs = 0;
  let prev: [number, number] | undefined;
  for (const [, xs, ys, inner] of svg.matchAll(GROUP)) {
    glyphs += 1;
    if (glyphs > MAX_GLYPHS) {
      throw new DeqError("LIMIT_EXCEEDED", `SVG has more than ${String(MAX_GLYPHS)} glyphs`);
    }
    const x = Number(xs);
    const y = Number(ys);
    if (prev) {
      // Gaps are capped at what leet() can write, so crafted offsets cannot blow up the text.
      const rows = Math.min(Math.round((y - prev[1]) / ay), MAX_LINES);
      const gap = Math.round(Math.abs(x - prev[0]) / ax) - 1;
      text += rows > 0 ? "\n".repeat(rows) : " ".repeat(Math.min(Math.max(0, gap), MAX_GLYPHS));
    }
    prev = [x, y];
    const char = byMarkup.get(inner ?? "");
    if (char === undefined) unmatched += 1;
    text += char ?? "�";
  }
  return { text, script, unmatched };
}
