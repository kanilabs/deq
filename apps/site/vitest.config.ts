import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

// Unit tests cover the typed helpers and the Studio logic (the runes store is compiled by
// the Svelte plugin); pages, endpoints and Studio components are covered by the Playwright
// suite in `e2e/` against the built site. Spread rather than mergeConfig, which would
// append to the shared coverage list instead of replacing it.
export default defineConfig({
  plugins: [svelte()],
  test: {
    ...shared.test,
    include: ["test/**/*.test.ts"],
    coverage: {
      ...shared.test?.coverage,
      include: ["src/i18n/**/*.ts", "src/lib/**/*.ts", "src/studio/**/*.ts"],
      // DOM-only glue, exercised by the e2e suite.
      exclude: ["src/studio/svg.ts", "src/studio/db.ts"],
    },
  },
});
