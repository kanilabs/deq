/**
 * Documentation screenshots (ADR 0020): opens the built site in Playwright's Chromium at
 * 1280 × 800 in light and dark, and in Sorani where right-to-left layout matters, and
 * writes `public/screens/<name>-<locale>-<theme>.webp`. The guides in `docs/` embed them.
 * Run `just screenshots` (fonts, media, build, then this script against a preview) and
 * commit the files:
 *
 *   pnpm --filter @0xdolan/deq-site screenshots [name ...]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { type Browser, chromium, type Page } from "@playwright/test";

import { encodeWebp } from "./webp.ts";

const OUT = fileURLToPath(new URL("../public/screens/", import.meta.url));
const ORIGIN = process.env["DEQ_SCREENSHOT_ORIGIN"] ?? "http://localhost:4321/deq/";
const VIEWPORT = { width: 1280, height: 800 };
const THEMES = ["light", "dark"] as const;

type Theme = (typeof THEMES)[number];
type Locale = "en" | "ckb";

interface Shot {
  readonly name: string;
  readonly locales: readonly Locale[];
  /** Site path without the base or locale prefix. */
  readonly path: string;
  /** Brings the page to the state to capture. */
  readonly prepare?: (page: Page) => Promise<void>;
}

/** The design the Studio screenshots open, as a share link (`#d=1.<deflate-raw, base64url>`). */
const DESIGN = {
  v: 1,
  items: [
    { id: "a", shape: "kurdish-sun", x: 120, y: 80, options: { size: 200, color: "#c8102e" } },
    { id: "b", shape: "dot-rosette", x: 380, y: 80, options: { size: 200 } },
    { id: "c", shape: "tree-comb", x: 120, y: 330, options: { size: 200, color: "#007a3d" } },
    { id: "d", shape: "lozenge-nested", x: 380, y: 330, options: { size: 200, strokeWidth: 2.5 } },
  ],
};

async function shareToken(doc: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(doc)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return `1.${Buffer.from(bytes).toString("base64url")}`;
}

async function studioReady(page: Page): Promise<void> {
  await page.locator(".studio.ready").waitFor();
  await page
    .locator(".notices .notice")
    .first()
    .waitFor({ state: "attached", timeout: 2_000 })
    .catch(() => undefined);
}

async function closeNotices(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const n of document.querySelectorAll(".notices .notice")) n.remove();
  });
}

const SHOTS: readonly Shot[] = [
  { name: "home", locales: ["en", "ckb"], path: "" },
  { name: "icons", locales: ["en"], path: "icons/" },
  { name: "icon", locales: ["en"], path: "icons/kurdish-sun/" },
  {
    name: "studio",
    locales: ["en", "ckb"],
    path: `studio/#d=${await shareToken(DESIGN)}`,
    prepare: async (page) => {
      await studioReady(page);
      await closeNotices(page);
      await page.locator(".stage").first().focus();
      await page.keyboard.press("1");
      await page.locator("[data-item='a']").first().click();
    },
  },
  {
    name: "studio-export",
    locales: ["en"],
    path: `studio/#d=${await shareToken(DESIGN)}`,
    prepare: async (page) => {
      await studioReady(page);
      await closeNotices(page);
      await page.locator(".stage").first().focus();
      await page.keyboard.press("1");
      await page.locator('.toolbar [data-action="export"]').click();
      await page.locator("dialog.export").waitFor();
    },
  },
  {
    name: "shape-editor",
    locales: ["en"],
    path: "studio/",
    prepare: async (page) => {
      await studioReady(page);
      await page.locator('[data-action="new-shape"]').click();
      const editor = page.getByRole("dialog");
      await editor.locator('select:has(option[value="ring"])').first().selectOption("ring");
      await editor.locator('[data-part="line"]').click();
      await editor.getByRole("button", { name: "Make a radial array" }).click();
    },
  },
  {
    name: "leet",
    locales: ["en", "ckb"],
    path: "leet/",
    prepare: async (page) => {
      const text = page.locator("textarea").first();
      await text.waitFor();
      await text.fill(page.url().includes("/ckb/") ? "ڕۆژ باش" : "Roj baş");
    },
  },
  {
    name: "generate",
    locales: ["en"],
    path: "generate/",
    prepare: (page) => page.locator("svg").first().waitFor(),
  },
  { name: "flag", locales: ["en"], path: "flag/" },
  { name: "fonts", locales: ["en"], path: "fonts/" },
];

async function capture(
  browser: Browser,
  shot: Shot,
  locale: Locale,
  theme: Theme,
  encoder: Page,
): Promise<void> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: theme,
    locale: locale === "ckb" ? "ckb-IQ" : "en-GB",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  try {
    const page = await context.newPage();
    const url = `${ORIGIN}${locale === "en" ? "" : `${locale}/`}${shot.path}`;
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`${url}: HTTP ${String(response?.status())}`);
    await page.evaluate(() => document.fonts.ready);
    await shot.prepare?.(page);
    await page.waitForLoadState("networkidle");
    const png = await page.screenshot({ type: "png" });
    const file = `${OUT}${shot.name}-${locale}-${theme}.webp`;
    const webp = await encodeWebp(encoder, png, VIEWPORT.width);
    await writeFile(file, webp);
    console.log(`${file} (${String(Math.round(webp.length / 1024))} KiB)`);
  } finally {
    await context.close();
  }
}

const only = new Set(process.argv.slice(2));
const shots = SHOTS.filter((s) => only.size === 0 || only.has(s.name));
if (shots.length === 0) throw new Error(`No such screenshot: ${[...only].join(", ")}`);

const browser = await chromium.launch();
try {
  await mkdir(OUT, { recursive: true });
  const encoder = await browser.newPage();
  for (const shot of shots) {
    for (const locale of shot.locales) {
      for (const theme of THEMES) await capture(browser, shot, locale, theme, encoder);
    }
  }
} finally {
  await browser.close();
}
