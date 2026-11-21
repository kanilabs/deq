/**
 * Writes the golden fixtures to `spec/fixtures/leet/` from the built library (`dist/`; the
 * `fixtures` package script builds it first).
 *
 *   node scripts/fixtures.ts           write (and remove stale files)
 *   node scripts/fixtures.ts --check   fail if any fixture is missing, stale or extra
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type * as Generator from "../src/index.ts";
import { LEET_FIXTURES, leetFiles } from "./fixture-cases.ts";
import { readText } from "./generate-leet.ts";

/** The built library; a computed specifier so typechecking does not need `dist/`. */
const DIST: string = new URL("../dist/index.js", import.meta.url).href;
const lib = (await import(DIST)) as typeof Generator;

const check = process.argv.includes("--check");
const expected = leetFiles(lib);
mkdirSync(LEET_FIXTURES, { recursive: true });
const problems: string[] = [];
for (const name of readdirSync(LEET_FIXTURES)) {
  if (expected.has(name)) continue;
  if (check) problems.push(`extra: ${name}`);
  else rmSync(join(LEET_FIXTURES, name));
}
for (const [name, text] of expected) {
  const path = join(LEET_FIXTURES, name);
  let current: string | undefined;
  try {
    current = readText(path);
  } catch {
    current = undefined;
  }
  if (current === text) continue;
  if (check) problems.push(`${current === undefined ? "missing" : "stale"}: ${name}`);
  else writeFileSync(path, text);
}
if (problems.length > 0) {
  console.error(
    `${problems.join("\n")}\nrun \`pnpm --filter @0xdolan/deq-generator fixtures\` to update`,
  );
  process.exit(1);
}
