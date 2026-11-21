/**
 * Writes `spec/fixtures/cli/` from the shared CLI cases, run against the Node CLI.
 *
 *   pnpm --filter @0xdolan/deq-cli fixtures   (builds dist first)
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type * as Cli from "../src/cli.ts";
import { OUT_DIR, buildFixtures } from "./cases.ts";

/** The built CLI; a computed specifier so typechecking does not need `dist/`. */
const DIST: string = new URL("../dist/cli.js", import.meta.url).href;
const { main } = (await import(DIST)) as typeof Cli;

const { manifest, fixtures } = await buildFixtures(main);
rmSync(OUT_DIR, { recursive: true, force: true });
for (const [path, data] of fixtures) {
  const file = join(OUT_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}
writeFileSync(join(OUT_DIR, "manifest.json"), manifest);
console.log(`wrote ${String(fixtures.length)} CLI fixtures`);
