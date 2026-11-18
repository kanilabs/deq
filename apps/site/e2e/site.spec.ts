import { gzipSync } from "node:zlib";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { prefix: "", lang: "en", dir: "ltr" },
  { prefix: "ckb/", lang: "ckb", dir: "rtl" },
  { prefix: "kmr/", lang: "kmr", dir: "ltr" },
] as const;
const PAGES = ["", "icons/", "icons/kurdish-sun/", "flag/", "fonts/", "brand/", "about/", "docs/"];
/** PRD §10: JavaScript on non-Studio pages, gzipped. */
const JS_BUDGET = 50 * 1024;

/** Collect CSP violations reported by the page. */
async function watchCsp(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/iu.test(msg.text())) violations.push(msg.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`Content Security Policy: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return violations;
}

for (const locale of LOCALES) {
  for (const path of PAGES) {
    test(`${locale.lang} /${path}: lang, dir, CSP, axe, JS budget`, async ({ page }) => {
      const violations = await watchCsp(page);
      const scripts: Promise<number>[] = [];
      page.on("response", (res) => {
        if (res.request().resourceType() === "script")
          scripts.push(res.body().then((b) => gzipSync(b).length));
      });
      const res = await page.goto(`${locale.prefix}${path}`);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      const html = page.locator("html");
      await expect(html).toHaveAttribute("lang", locale.lang);
      await expect(html).toHaveAttribute("dir", locale.dir);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
      if (locale.lang !== "en")
        await expect(page.getByRole("note").or(page.locator(".sl-banner"))).toBeVisible();

      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const serious = axe.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      ).toEqual([]);

      const inline = await page.$$eval("script:not([src])", (els) =>
        els.map((e) => e.textContent).join(""),
      );
      const total =
        (await Promise.all(scripts)).reduce((a, b) => a + b, 0) + gzipSync(inline).length;
      expect(total).toBeLessThanOrEqual(JS_BUDGET);
      expect(violations).toEqual([]);
    });
  }
}

test("dark theme passes axe and persists across reloads", async ({ page }) => {
  await page.goto("icons/");
  await page.locator("starlight-theme-select select").first().selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const path of ["", "icons/", "flag/", "ckb/brand/"]) {
    await page.goto(path);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
    expect(
      axe.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => v.id),
    ).toEqual([]);
  }
});

test("icon filter narrows the grid and announces the count", async ({ page }) => {
  await page.goto("icons/");
  const visible = page.locator("[data-search]:visible");
  const all = await visible.count();
  await page.getByRole("searchbox").fill("sun");
  await expect.poll(() => visible.count()).toBeLessThan(all);
  await expect(page.locator(".count")).toContainText(String(await visible.count()));
  await page.getByRole("searchbox").fill("zzzz-no-match");
  await expect(page.locator("[data-icon-empty]")).toBeVisible();
});

test("unknown pages get the 404 page", async ({ page }) => {
  const res = await page.goto("no-such-page/");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toBeVisible();
});

test("SEO files are served", async ({ request }) => {
  for (const [path, needle] of [
    ["robots.txt", "Sitemap:"],
    ["sitemap-index.xml", "<sitemapindex"],
    ["llms.txt", "# Deq"],
    ["llms-full.txt", "## Shapes"],
    ["manifest.webmanifest", '"start_url"'],
    ["svg/kurdish-sun.svg", "<svg"],
  ] as const) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(await res.text(), path).toContain(needle);
  }
  const og = await request.get("og/icons/kurdish-sun.png");
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("the site works offline after the service worker installs", async ({ page, context }) => {
  await page.goto("");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first visit is not controlled yet; a reload hands it to the worker.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  for (const path of ["icons/", "icons/kurdish-sun/", "ckb/flag/", "kmr/docs/"]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
  }
  await context.setOffline(false);
});

test("search finds a shape without CSP violations", async ({ page }) => {
  const violations = await watchCsp(page);
  await page.goto("");
  await page.locator("site-search button[data-open-modal]").first().click();
  await page.locator("dialog[open] input").fill("sun");
  await expect(page.locator("dialog[open] .pagefind-ui__result").first()).toBeVisible();
  expect(violations).toEqual([]);
});
