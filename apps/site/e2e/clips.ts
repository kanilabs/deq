/**
 * Feature clips for the READMEs (Phase 12, ADR 0023): short recordings of the built site in
 * Playwright's Chromium (Studio, Deq Leet, patterns), encoded with ffmpeg as WebM and as a
 * palette GIF in `public/clips/<name>.{webm,gif}`. Run `just clips` against a preview and
 * commit the files:
 *
 *   pnpm --filter @0xdolan/deq-site clips [name ...]
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { chromium, type Page } from "@playwright/test";

import { closeNotices, DESIGN, shareToken, studioReady } from "./studio-design.ts";

const run = promisify(execFile);
const OUT = fileURLToPath(new URL("../public/clips/", import.meta.url));
const ORIGIN = process.env["DEQ_SCREENSHOT_ORIGIN"] ?? "http://localhost:4321/deq/";
const SIZE = { width: 1280, height: 720 };
/** GIF width in px; the WebM keeps the full size. */
const GIF_WIDTH = 800;

interface Clip {
  readonly name: string;
  readonly path: string;
  /** Wait for the page, before the part of the recording that is kept. */
  readonly ready: (page: Page) => Promise<void>;
  /** What the clip shows. */
  readonly play: (page: Page) => Promise<void>;
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

const CLIPS: readonly Clip[] = [
  {
    name: "studio",
    path: `studio/#d=${await shareToken(DESIGN)}`,
    ready: async (page) => {
      await studioReady(page);
      await closeNotices(page);
      await page.locator(".stage").first().focus();
      await page.keyboard.press("1");
    },
    play: async (page) => {
      for (const id of ["a", "b", "c", "d"]) {
        await page.locator(`[data-item='${id}']`).first().click();
        await pause(page, 500);
      }
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Shift+ArrowLeft");
        await pause(page, 120);
      }
      await pause(page, 600);
      await page.keyboard.press("Control+z");
      await pause(page, 1000);
    },
  },
  {
    name: "leet",
    path: "leet/",
    ready: async (page) => {
      await page.locator("textarea").first().waitFor();
    },
    play: async (page) => {
      const text = page.locator("textarea").first();
      await text.fill("");
      await pause(page, 400);
      await text.pressSequentially("Roj baş, Kurdistan", { delay: 140 });
      await pause(page, 1500);
    },
  },
  {
    name: "patterns",
    path: "generate/",
    ready: async (page) => {
      await page.locator("[data-action='seed']").first().waitFor();
    },
    play: async (page) => {
      const kind = page.locator("select[id$='-kind']").first();
      for (const value of ["band", "grid", "rosette", "border"]) {
        await kind.selectOption(value);
        await pause(page, 700);
        await page.locator("[data-action='seed']").first().click();
        await pause(page, 700);
      }
    },
  },
];

async function record(browser: Awaited<ReturnType<typeof chromium.launch>>, clip: Clip) {
  const dir = await mkdtemp(join(tmpdir(), "deq-clip-"));
  try {
    const context = await browser.newContext({
      viewport: SIZE,
      recordVideo: { dir, size: SIZE },
      colorScheme: "light",
      locale: "en-GB",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const started = Date.now();
    const response = await page.goto(`${ORIGIN}${clip.path}`, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`${clip.path}: HTTP ${String(response?.status())}`);
    await page.evaluate(() => document.fonts.ready);
    await clip.ready(page);
    await pause(page, 400);
    // The recording starts with the page load; keep only what follows.
    const skip = (Date.now() - started) / 1000;
    await clip.play(page);
    await context.close();
    const [video] = await readdir(dir);
    if (video === undefined) throw new Error(`${clip.name}: no recording`);
    const source = join(dir, video);
    const webm = `${OUT}${clip.name}.webm`;
    const gif = `${OUT}${clip.name}.gif`;
    const base = ["-y", "-loglevel", "error", "-ss", skip.toFixed(2), "-i", source];
    await run("ffmpeg", [
      ...base,
      ...["-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-an", "-map_metadata", "-1", webm],
    ]);
    await run("ffmpeg", [
      ...base,
      "-vf",
      `fps=12,scale=${String(GIF_WIDTH)}:-1:flags=lanczos,split[a][b];` +
        "[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
      ...["-map_metadata", "-1", gif],
    ]);
    for (const file of [webm, gif]) {
      console.log(`${file} (${String(Math.round((await stat(file)).size / 1024))} KiB)`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const only = new Set(process.argv.slice(2));
const clips = CLIPS.filter((c) => only.size === 0 || only.has(c.name));
if (clips.length === 0) throw new Error(`No such clip: ${[...only].join(", ")}`);

const browser = await chromium.launch();
try {
  await mkdir(OUT, { recursive: true });
  for (const clip of clips) await record(browser, clip);
} finally {
  await browser.close();
}
