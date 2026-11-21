/**
 * Writes the flat geometry of every shape (core's `expand`, default parameters) as JSON for
 * the font builder in `scripts/deq-fonts`.
 *
 *   node scripts/font-data.ts <out.json>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { expand, listShapes } from "@0xdolan/deq-core";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: node scripts/font-data.ts <out.json>");
const shapes = listShapes().map((s) => ({
  id: s.id,
  name: s.names.en,
  kmr: s.names.kmr.text,
  aliases: s.aliases,
  category: s.category,
  flat: expand(s.id),
}));
const file = resolve(process.env["INIT_CWD"] ?? process.cwd(), out);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify({ shapes })}\n`);
