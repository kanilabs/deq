import { defineConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

// Unit tests cover the typed helpers; pages and endpoints are covered by the Playwright
// suite in `e2e/` against the built site. Spread rather than mergeConfig, which would
// append to the shared coverage list instead of replacing it.
export default defineConfig({
  test: {
    ...shared.test,
    include: ["test/**/*.test.ts"],
    coverage: { ...shared.test?.coverage, include: ["src/i18n/**/*.ts", "src/lib/**/*.ts"] },
  },
});
