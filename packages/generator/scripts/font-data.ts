/**
 * Writes the flat geometry of every Deq Leet glyph (basic, advanced alternatives and full,
 * per script) as JSON for the Leet font builder in `scripts/deq-fonts` (ADR 0016).
 * Reads the built package (`dist/`), like the fixtures.
 *
 *   node scripts/font-data.ts <out.json>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type * as Generator from "../src/index.ts";

const DIST: string = new URL("../dist/index.js", import.meta.url).href;
const lib = (await import(DIST)) as typeof Generator;

const out = process.argv[2];
if (out === undefined) throw new Error("usage: node scripts/font-data.ts <out.json>");
const scripts = Object.fromEntries(
  (["latin", "sorani"] as const).map((script) => {
    const table = lib.leetTable(script);
    return [
      script,
      {
        direction: table.direction,
        aliases: table.aliases,
        glyphs: table.glyphs.map((g) => ({
          char: g.char,
          basic: lib.expandGlyph(g.basic),
          advanced: g.advanced.map((a) => lib.expandGlyph(a)),
          full: lib.expandGlyph(g.full),
        })),
      },
    ];
  }),
);
const file = resolve(process.env["INIT_CWD"] ?? process.cwd(), out);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify({ scripts })}\n`);
