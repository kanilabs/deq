/**
 * Writes the static files of the package after `tsc`: `dist/svg/<id>.svg`,
 * `dist/sprite.svg` and `dist/icons.json` (id, names, category, aliases and tags), using
 * the same exporters as the rest of Deq, and `dist/integrity.json` (SRI hashes).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { listShapes } from "@0xdolan/deq-core";
import { exportShapes } from "@0xdolan/deq-exporters";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const shapes = listShapes();
const ids = shapes.map((s) => s.id);

mkdirSync(join(DIST, "svg"), { recursive: true });
for (const file of await exportShapes("svg", ids))
  writeFileSync(join(DIST, "svg", file.name), file.data);
const [sprite] = await exportShapes("svg-sprite", ids);
if (!sprite) throw new Error("no sprite");
writeFileSync(join(DIST, "sprite.svg"), sprite.data);
const meta = shapes.map((s) => ({
  id: s.id,
  names: s.names,
  category: s.category,
  aliases: s.aliases,
  tags: s.tags,
}));
writeFileSync(join(DIST, "icons.json"), `${JSON.stringify(meta, null, 2)}\n`);

/** Subresource Integrity hashes for the files people load from a CDN. */
const integrity = Object.fromEntries(
  ["sprite.svg", "icons.json"].map((f) => [
    f,
    `sha384-${createHash("sha384")
      .update(readFileSync(join(DIST, f)))
      .digest("base64")}`,
  ]),
);
writeFileSync(join(DIST, "integrity.json"), `${JSON.stringify(integrity, null, 2)}\n`);
