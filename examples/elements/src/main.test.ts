import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

it("renders three icons", async () => {
  const html = readFileSync(join(import.meta.dirname, "..", "index.html"), "utf8");
  document.body.innerHTML = /<body>([\s\S]*)<script/.exec(html)?.[1] ?? "";
  await import("./main.ts");
  expect(document.querySelectorAll("deq-icon > svg")).toHaveLength(3);
  expect(document.body.innerHTML).toContain('color="#ED2024"');
  expect(document.body.innerHTML).toContain('aria-hidden="true"');
});
