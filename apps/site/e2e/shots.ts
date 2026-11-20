/**
 * Showcase screenshots (ADR 0019): opens each project in `content/showcase.json` at
 * 1280 × 800 in Playwright's Chromium and writes `public/showcase/<id>-{640,1280}.webp`.
 * Chromium itself encodes the WebP files, so no image library is needed. Run by hand
 * when a project changes, and commit the files:
 *
 *   pnpm --filter @0xdolan/deq-site shots [id ...]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium, type Page } from "@playwright/test";

import showcase from "../../../content/showcase.json" with { type: "json" };

const OUT = fileURLToPath(new URL("../public/showcase/", import.meta.url));
const VIEWPORT = { width: 1280, height: 800 };
const WIDTHS = [640, 1280];
const QUALITY = 0.8;

async function encode(page: Page, png: Buffer, width: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    async ({ src, width, quality }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((image.naturalHeight * width) / image.naturalWidth);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2d context");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", quality);
    },
    { src: `data:image/png;base64,${png.toString("base64")}`, width, quality: QUALITY },
  );
  if (!dataUrl.startsWith("data:image/webp;base64,")) throw new Error("WebP encoding failed");
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

const only = new Set(process.argv.slice(2));
const projects = showcase.projects.filter((p) => only.size === 0 || only.has(p.id));
if (projects.length === 0) throw new Error(`No such project: ${[...only].join(", ")}`);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "light",
    locale: "en-GB",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const encoder = await context.newPage();
  await mkdir(OUT, { recursive: true });
  for (const project of projects) {
    const page = await context.newPage();
    const response = await page.goto(project.url, { waitUntil: "networkidle", timeout: 60_000 });
    if (!response?.ok()) {
      throw new Error(`${project.id}: HTTP ${String(response?.status())}`);
    }
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: "png" });
    await page.close();
    for (const width of WIDTHS) {
      const file = `${OUT}${project.id}-${String(width)}.webp`;
      const webp = await encode(encoder, png, width);
      await writeFile(file, webp);
      console.log(`${file} (${String(Math.round(webp.length / 1024))} KiB)`);
    }
  }
} finally {
  await browser.close();
}
