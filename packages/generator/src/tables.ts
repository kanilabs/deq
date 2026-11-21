/** The Deq Leet tables and text normalisation (ADR 0015). */
import { DeqError } from "@0xdolan/deq-core";
import type { Params } from "@0xdolan/deq-core";

import { TABLES } from "./generated/leet.js";

/** A script with a Leet table. */
export type Script = "latin" | "sorani";

/** One shape placed in a 24 x 24 glyph cell, about the centre [12, 12]. */
export interface GlyphPart {
  readonly shape: string;
  readonly params?: Params;
  readonly transform?: {
    readonly translate?: readonly [number, number];
    readonly scale?: number;
    readonly rotate?: number;
  };
}

/** A glyph: one or more shapes on the 24 x 24 grid. */
export type Glyph = readonly GlyphPart[];

/** One character of a table with its glyph at each level. */
export interface LeetEntry {
  readonly char: string;
  /** How well the basic glyph reads as the character; `count` marks dot-count digits. */
  readonly fit: "good" | "fair" | "rough" | "count";
  readonly basic: Glyph;
  /** Alternatives for the advanced level; empty means the basic glyph. */
  readonly advanced: readonly Glyph[];
  readonly full: Glyph;
}

/** The mapping table of one script. */
export interface LeetTable {
  readonly version: number;
  readonly script: Script;
  readonly direction: "ltr" | "rtl";
  /** Characters read as another character of the table (after case folding). */
  readonly aliases: Readonly<Record<string, string>>;
  readonly glyphs: readonly LeetEntry[];
}

/** The longest input accepted, in UTF-16 code units. */
export const MAX_INPUT = 1024;
/** The most glyphs one text may draw. */
export const MAX_GLYPHS = 256;
/** The most lines one text may have. */
export const MAX_LINES = 32;

const indexes = new Map<Script, Map<string, LeetEntry>>();

/** The table of `script`. */
export function leetTable(script: Script): LeetTable {
  return TABLES[script];
}

function index(script: Script): Map<string, LeetEntry> {
  let map = indexes.get(script);
  if (!map) {
    map = new Map(TABLES[script].glyphs.map((e) => [e.char, e]));
    indexes.set(script, map);
  }
  return map;
}

/** The entry for an already normalised character, if the table has one. */
export function entryOf(script: Script, char: string): LeetEntry | undefined {
  return index(script).get(char);
}

/** Pick the script of `text`: Sorani when it has Arabic-script letters, else Latin. */
export function detectScript(text: string): Script {
  return /[؀-ۿ]/u.test(text) ? "sorani" : "latin";
}

/** One unit of normalised text: a table character, a space or a line break. */
export type Token =
  | { readonly kind: "char"; readonly char: string; readonly entry: LeetEntry }
  | { readonly kind: "space" };

/** The result of {@link normalize}. */
export interface Normalized {
  /** Lines of tokens, without leading or trailing spaces or empty lines. */
  readonly lines: readonly (readonly Token[])[];
  /** The normalised text (what decoding `basic` output gives back). */
  readonly text: string;
  /** Characters with no glyph in the table, in first-seen order. */
  readonly unknown: readonly string[];
}

// Joiners, tatweel and bidi controls carry no letter of their own.
const IGNORED = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u0640\uFEFF]/gu;
const SPACE = /^[\t \u00A0\u2000-\u200A\u202F\u205F\u3000]$/u;

/**
 * Normalise `input` for `script`: NFC, line breaks to `\n`, joiners and tatweel removed,
 * upper case, then the table's aliases. Input is plain text and is never parsed as markup.
 *
 * @throws {DeqError} `LIMIT_EXCEEDED` for input longer than {@link MAX_INPUT}, more than
 * {@link MAX_GLYPHS} glyphs or more than {@link MAX_LINES} lines.
 */
export function normalize(input: string, script: Script): Normalized {
  if (input.length > MAX_INPUT) {
    throw new DeqError("LIMIT_EXCEEDED", `text is longer than ${String(MAX_INPUT)} characters`);
  }
  const { aliases } = TABLES[script];
  const unknown: string[] = [];
  let line: Token[] = [];
  const raw: Token[][] = [line];
  let glyphs = 0;
  const text = input.normalize("NFC").replace(/\r\n?/gu, "\n").replace(IGNORED, "");
  for (const ch of text) {
    if (ch === "\n") {
      line = [];
      raw.push(line);
      continue;
    }
    if (SPACE.test(ch)) {
      line.push({ kind: "space" });
      continue;
    }
    for (const up of ch.toUpperCase()) {
      const char = aliases[up] ?? up;
      const entry = index(script).get(char);
      if (entry) {
        line.push({ kind: "char", char, entry });
        glyphs += 1;
      } else if (!unknown.includes(ch)) {
        unknown.push(ch);
      }
    }
  }
  if (glyphs > MAX_GLYPHS) {
    throw new DeqError("LIMIT_EXCEEDED", `text has more than ${String(MAX_GLYPHS)} glyphs`);
  }
  const trimmed = raw.map((line) => {
    let a = 0;
    let b = line.length;
    while (a < b && line[a]?.kind === "space") a += 1;
    while (b > a && line[b - 1]?.kind === "space") b -= 1;
    return line.slice(a, b);
  });
  while (trimmed.length > 0 && trimmed[0]?.length === 0) trimmed.shift();
  while (trimmed.length > 0 && trimmed[trimmed.length - 1]?.length === 0) trimmed.pop();
  if (trimmed.length > MAX_LINES) {
    throw new DeqError("LIMIT_EXCEEDED", `text has more than ${String(MAX_LINES)} lines`);
  }
  return {
    lines: trimmed,
    text: trimmed
      .map((line) => line.map((t) => (t.kind === "char" ? t.char : " ")).join(""))
      .join("\n"),
    unknown,
  };
}
