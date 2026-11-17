/** Writes `dist/integrity.json`: the Subresource Integrity hash of the CDN bundle. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dirname, "..", "dist");
const file = "cdn/deq-elements.js";
const hash = createHash("sha384")
  .update(readFileSync(join(dist, file)))
  .digest("base64");
writeFileSync(
  join(dist, "integrity.json"),
  `${JSON.stringify({ [file]: `sha384-${hash}` }, null, 2)}\n`,
);
