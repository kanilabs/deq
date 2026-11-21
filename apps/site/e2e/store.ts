/**
 * PWA store screenshots (Phase 12, ADR 0023): the built site in Playwright's Chromium on a
 * phone (390 × 844 at 2×) and a desktop (1280 × 800 at 1.5×), in light and dark, written to
 * `public/store/<name>-<form>-<theme>.webp`. The manifest lists the light ones; the press kit
 * has them all. Run `just store` and commit the files:
 *
 *   pnpm --filter @0xdolan/deq-site store [name ...]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { type Browser, chromium, type Page } from "@playwright/test";

import { closeNotices, DESIGN, shareToken, studioReady } from "./studio-design.ts";
import { encodeWebp } from "./webp.ts";

const OUT = fileURLToPath(new URL("../public/store/", import.meta.url));
const ORIGIN = process.env["DEQ_SCREENSHOT_ORIGIN"] ?? "http://localhost:4321/deq/";
const THEMES = ["light", "dark"] as const;

/** The store forms; sizes are in CSS pixels, the files are `scale` times larger. */
const FORMS = {
  phone: { width: 390, height: 844, scale: 2, mobile: true },
  desktop: { width: 1280, height: 800, scale: 1.5, mobile: false },
} as const;

interface Shot {
  readonly name: string;
  readonly path: string;
  readonly prepare?: (page: Page) => Promise<void>;
}

const SHOTS: readonly Shot[] = [
  { name: "home", path: "" },
  { name: "icons", path: "icons/" },
  {
    name: "studio",
    path: `studio/#d=${await shareToken(DESIGN)}`,
    prepare: async (page) => {
      await studioReady(page);
      await closeNotices(page);
      // Fit the design to the canvas (the phone opens on the origin).
      await page.locator(".stage").first().focus();
      await page.keyboard.press("1");
    },
  },
  {
    name: "leet",
    path: "leet/",
    prepare: async (page) => {
      const text = page.locator("textarea").first();
      await text.waitFor();
      await text.fill("Roj baş");
    },
  },
];

async function capture(
  browser: Browser,
  shot: Shot,
  form: keyof typeof FORMS,
  theme: (typeof THEMES)[number],
  encoder: Page,
): Promise<void> {
  const f = FORMS[form];
  const context = await browser.newContext({
    viewport: { width: f.width, height: f.height },
    deviceScaleFactor: f.scale,
    isMobile: f.mobile,
    hasTouch: f.mobile,
    colorScheme: theme,
    locale: "en-GB",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  try {
    const page = await context.newPage();
    const url = `${ORIGIN}${shot.path}`;
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`${url}: HTTP ${String(response?.status())}`);
    await page.evaluate(() => document.fonts.ready);
    await shot.prepare?.(page);
    await page.waitForLoadState("networkidle");
    const png = await page.screenshot({ type: "png" });
    const file = `${OUT}${shot.name}-${form}-${theme}.webp`;
    const webp = await encodeWebp(encoder, png, f.width * f.scale);
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
    for (const form of ["phone", "desktop"] as const) {
      for (const theme of THEMES) await capture(browser, shot, form, theme, encoder);
    }
  }
} finally {
  await browser.close();
}
