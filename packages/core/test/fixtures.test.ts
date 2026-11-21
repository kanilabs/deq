import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fixtureCases, manifest, renderCase } from "../scripts/fixture-cases.ts";
import { SPEC_DIR, generatedFiles, readText } from "../scripts/generate-shapes.ts";
import { compose, listFlagVariants, listShapes, render, renderFlag } from "../src/index.js";

const FIXTURES = join(SPEC_DIR, "fixtures");
const cases = fixtureCases(listShapes(), listFlagVariants());

describe("readText", () => {
  const dir = mkdtempSync(join(tmpdir(), "deq-core-"));
  const file = join(dir, "a.json");
  writeFileSync(file, "[1]");

  it("reads a regular file", () => {
    expect(readText(file)).toBe("[1]");
  });
  it("refuses files over the limit", () => {
    expect(() => readText(file, 2)).toThrow(/larger than 2 bytes/);
  });
  it("refuses directories", () => {
    expect(() => readText(dir)).toThrow();
  });
  it.skipIf(process.platform === "win32")("refuses symlinks", () => {
    const link = join(dir, "link.json");
    symlinkSync(file, link);
    expect(() => readText(link)).toThrow(/refusing symlink/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("generated data", () => {
  it.each(generatedFiles().map(([file, text]) => [file, text] as const))(
    "%s matches spec/ (run `pnpm --filter @0xdolan/deq-core generate`)",
    (file, text) => {
      expect(readFileSync(file, "utf8")).toBe(text);
    },
  );
});

describe("golden fixtures (run `pnpm --filter @0xdolan/deq-core fixtures` after a change)", () => {
  it("manifest lists every case", () => {
    expect(readFileSync(join(FIXTURES, "manifest.json"), "utf8")).toBe(manifest(cases));
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
  });
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(renderCase(c, { render, compose, renderFlag })).toBe(
      readFileSync(join(FIXTURES, c.file), "utf8"),
    );
  });
});
