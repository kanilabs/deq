// @vitest-environment node
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { apiDocPath, generateApiDoc } from "../../../scripts/api-docs.ts";

it(
  "docs/api/exporters.md matches the TSDoc comments (run `just api-docs`)",
  { timeout: 120_000 },
  () => {
    expect(readFileSync(apiDocPath("exporters"), "utf8")).toBe(generateApiDoc("exporters"));
  },
);
