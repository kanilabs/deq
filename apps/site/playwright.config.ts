import { defineConfig, devices } from "@playwright/test";

/** End-to-end checks against the built site (`pnpm build` first): ADR 0012 definition of done. */
export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4321/deq/", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec astro preview --port 4321 --ignore-lock",
    url: "http://localhost:4321/deq/",
    reuseExistingServer: !process.env["CI"],
  },
});
