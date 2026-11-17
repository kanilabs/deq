/**
 * Writes `spec/fixtures/cli/` from the shared CLI cases, run against the Node CLI.
 *
 *   pnpm --filter @0xdolan/deq-cli fixtures   (builds dist first)
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { main } from "../dist/cli.js";
import { OUT_DIR, buildFixtures } from "./cases.ts";

const { manifest, fixtures } = await buildFixtures(main);
rmSync(OUT_DIR, { recursive: true, force: true });
for (const [path, data] of fixtures) {
  const file = join(OUT_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}
writeFileSync(join(OUT_DIR, "manifest.json"), manifest);
console.log(`wrote ${String(fixtures.length)} CLI fixtures`);
