/**
 * Lighthouse gate (PRD §10, ADR 0012): every category must score at least 95 on a sample
 * of pages in all three locales. Runs against a preview server started by the caller:
 *
 *   pnpm exec astro preview --port 4321 & node e2e/lighthouse.ts
 *
 * Uses Playwright's Chromium, so no separate browser download is needed.
 */
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const ORIGIN = process.env["DEQ_SITE_URL"] ?? "http://localhost:4321/deq/";
const PAGES = [
  "",
  "icons/",
  "icons/kurdish-sun/",
  "flag/",
  "fonts/",
  "ckb/",
  "ckb/icons/",
  "kmr/docs/",
  "leet/",
  "ckb/generate/",
  "story/revival/",
  "ckb/sources/",
  "showcase/",
];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const MIN = 0.95;

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox"],
});
const failures: string[] = [];
try {
  for (const path of PAGES) {
    const url = new URL(path, ORIGIN).href;
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: CATEGORIES,
    });
    if (result === undefined) throw new Error(`Lighthouse returned nothing for ${url}`);
    const scores = CATEGORIES.map((id) => [id, result.lhr.categories[id]?.score ?? 0] as const);
    console.log(
      `${url}  ${scores.map(([id, s]) => `${id} ${String(Math.round(s * 100))}`).join("  ")}`,
    );
    for (const [id, score] of scores) {
      if (score < MIN) {
        const audits = Object.values(result.lhr.audits)
          .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative")
          .map((a) => a.id);
        failures.push(`${url} ${id} ${String(Math.round(score * 100))} (${audits.join(", ")})`);
      }
    }
  }
} finally {
  chrome.kill();
}
if (failures.length > 0) {
  console.error(`Below ${String(MIN * 100)}:\n${failures.join("\n")}`);
  process.exit(1);
}
