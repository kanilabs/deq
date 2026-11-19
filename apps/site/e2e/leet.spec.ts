import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 9d: the Leet and pattern pages (preview, frame, guides, font text, export, decode) and
 * the Studio tabs that insert them as editable groups. Runs on desktop and on a phone.
 */

const LOCALES = [
  { prefix: "", lang: "en", dir: "ltr" },
  { prefix: "ckb/", lang: "ckb", dir: "rtl" },
  { prefix: "kmr/", lang: "kmr", dir: "ltr" },
] as const;

const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 960;

async function watchProblems(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/iu.test(msg.text())) problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(err.message));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`Content Security Policy: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return problems;
}

async function axe(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function download(page: Page, panel: string, format: string) {
  const form = page.locator(`[data-panel="${panel}"] .scene-export`);
  await form.getByRole("combobox").first().selectOption(format);
  const pending = page.waitForEvent("download");
  await form.locator('[data-action="download"]').click();
  const file = await pending;
  return { name: file.suggestedFilename(), data: await readFile(await file.path()) };
}

const leet = (page: Page) => page.locator('[data-panel="leet"]');
const generate = (page: Page) => page.locator('[data-panel="generate"]');

for (const locale of LOCALES) {
  for (const path of ["leet/", "generate/"]) {
    test(`${locale.lang} /${path}: lang, dir, CSP, axe`, async ({ page }) => {
      const problems = await watchProblems(page);
      await page.goto(`${locale.prefix}${path}`);
      await expect(page.locator(".deq-panel .art svg")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale.lang);
      await expect(page.locator("html")).toHaveAttribute("dir", locale.dir);
      expect(await axe(page)).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
}

test("Leet previews text, frames it and shows guides", async ({ page }) => {
  await page.goto("leet/");
  const art = leet(page).locator(".art svg");
  await page.locator("#leet-page-text").fill("Roj\nbaş");
  await expect(art.locator("[data-layer]")).toHaveCount(6);
  await page.locator("#leet-page-frame").selectOption("band");
  await expect.poll(() => art.locator("[data-layer]").count()).toBeGreaterThan(6);
  await page.locator("#leet-page-frame").selectOption("border");
  await expect.poll(() => art.locator("[data-layer]").count()).toBeGreaterThan(6);
  await leet(page)
    .getByLabel(/line guides/u)
    .check();
  // Two lines: a top and a bottom guide each, outside the exported SVG.
  await expect(leet(page).locator(".guides line")).toHaveCount(4);
  await expect(leet(page).locator(".art .guides")).toHaveCount(0);
  await page.locator("#leet-page-text").fill("Deq ☃");
  await expect(leet(page).getByRole("status").first()).toContainText("☃");
});

test("Leet copies font text and reads exported SVG back", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("leet/");
  await page.locator("#leet-page-text").fill("Kurd");
  const pua = leet(page).locator(".pua-text");
  await expect(pua).toHaveAttribute("aria-label", "KURD");
  const text = (await pua.textContent()) ?? "";
  expect(Array.from(text).every((c) => (c.codePointAt(0) ?? 0) >= 0xf000)).toBe(true);
  await leet(page).locator('[data-action="copy"]').click();
  await expect(leet(page).locator(".pua .status")).not.toBeEmpty();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);

  const svg = await download(page, "leet", "svg");
  expect(svg.name).toBe("leet-kurd.svg");
  await page.locator("#leet-page-paste").fill(svg.data.toString("utf8"));
  await leet(page).locator('[data-action="decode"]').click();
  await expect(leet(page).locator("[data-decoded]")).toContainText("KURD");

  await page.locator("#leet-page-paste").fill("<svg/>");
  await leet(page).locator('[data-action="decode"]').click();
  await expect(leet(page).getByRole("alert")).toBeVisible();
});

test("Leet exports one layer per character, raster and PDF", async ({ page }) => {
  test.setTimeout(120_000);
  const problems = await watchProblems(page);
  await page.goto("leet/");
  await page.locator("#leet-page-text").fill("Deq");
  const layered = await download(page, "leet", "svg-layered");
  expect(layered.data.toString("utf8").match(/inkscape:groupmode="layer"/gu)).toHaveLength(3);
  const png = await download(page, "leet", "png");
  expect(png.data.subarray(1, 4).toString("latin1")).toBe("PNG");
  const pdf = await download(page, "leet", "pdf");
  expect(pdf.data.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  await expect(leet(page).locator('option[value="ico"]')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("patterns follow the seed and export", async ({ page }) => {
  await page.goto("generate/");
  const art = generate(page).locator(".art svg");
  const first = await art.innerHTML();
  await page.locator("#generate-page-seed").fill("42");
  await page.locator("#generate-page-seed").press("Enter");
  await expect.poll(() => art.innerHTML()).not.toBe(first);
  await page.locator("#generate-page-kind").selectOption("rosette");
  await page.locator("#generate-page-motifs").fill("kurdish-sun, dot");
  await expect(generate(page).locator(".note")).toContainText("kurdish-sun");
  const svg = await download(page, "generate", "svg");
  expect(svg.name).toMatch(/\.svg$/u);
  expect(svg.data.toString("utf8")).toContain("<svg");
});

test("Studio tabs insert Leet text and patterns as editable groups", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto("studio/");
  await expect(page.locator(".studio.ready")).toBeVisible();
  const showLibrary = async () => {
    if (mobile(page))
      await page.locator('.tabs button[aria-controls="studio-pane-library"]').click();
  };
  await showLibrary();
  await page.locator('[data-side="leet"]').click();
  await page.locator("#leet-studio-text").fill("Deq");
  expect(await axe(page)).toEqual([]);
  await leet(page).locator('[data-action="insert"]').click();
  await expect(page.locator("[data-item]")).toHaveCount(3);
  await expect(page.locator('[data-item][aria-pressed="true"]')).toHaveCount(3);

  await showLibrary();
  await page.locator('[data-side="generate"]').click();
  await generate(page).locator('[data-action="insert"]').click();
  await expect.poll(() => page.locator("[data-item]").count()).toBeGreaterThan(3);
  // One undo removes the whole pattern.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator("[data-item]")).toHaveCount(3);
});
