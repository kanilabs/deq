/**
 * The animated logo as video (Phase 12, ADR 0023): plays `assets/brand/logo-animated.svg` in
 * Playwright's Chromium frame by frame (the CSS animations paused and seeked, so every frame
 * is exact) and encodes `public/brand/logo-animated.{mp4,webm}` with ffmpeg. Run
 * `just brand-video` and commit the files:
 *
 *   pnpm --filter @0xdolan/deq-site brand-video
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { chromium } from "@playwright/test";

const run = promisify(execFile);
const ROOT = new URL("../../../", import.meta.url);
const OUT = fileURLToPath(new URL("apps/site/public/brand/", ROOT));
const brand = JSON.parse(await readFile(new URL("assets/brand/brand.json", ROOT), "utf8")) as {
  animation: { seconds: number };
};
const svg = await readFile(new URL("assets/brand/logo-animated.svg", ROOT), "utf8");

const SIZE = 1080;
const FPS = 30;
/** The animation plus a still hold at the end. */
const FRAMES = Math.ceil((brand.animation.seconds + 1.3) * FPS);

const frames = await mkdtemp(join(tmpdir(), "deq-logo-"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    reducedMotion: "no-preference",
  });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;background:#fff}svg{display:block;width:${String(SIZE)}px;height:${String(SIZE)}px}</style>${svg.replace(/^<!--[\s\S]*?-->\s*/u, "")}`,
  );
  for (let i = 0; i < FRAMES; i++) {
    await page.evaluate(
      (ms) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = ms;
        }
      },
      (i * 1000) / FPS,
    );
    await writeFile(
      join(frames, `${String(i).padStart(4, "0")}.png`),
      await page.screenshot({ type: "png" }),
    );
  }
} finally {
  await browser.close();
}

await mkdir(OUT, { recursive: true });
const input = [
  "-y",
  "-loglevel",
  "error",
  "-framerate",
  String(FPS),
  "-i",
  join(frames, "%04d.png"),
];
await run("ffmpeg", [
  ...input,
  ...["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart"],
  join(OUT, "logo-animated.mp4"),
]);
await run("ffmpeg", [
  ...input,
  ...["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-crf", "34", "-b:v", "0"],
  join(OUT, "logo-animated.webm"),
]);
await rm(frames, { recursive: true, force: true });
console.log(`${OUT}logo-animated.{mp4,webm} (${String(FRAMES)} frames)`);
