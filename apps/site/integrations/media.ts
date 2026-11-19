/**
 * Copies the story images into the site's `media/` folder (ADR 0018): the AVIF and WebP
 * variants that `deq-assets variants` (`just media`) writes to the gitignored
 * `assets/.generated/`, and the animated WebP masters from `assets/video/`. A build
 * without them only warns, unless `DEQ_REQUIRE_MEDIA=1` (CI and Pages) makes it fail.
 * The PWA does not precache these files.
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

const ASSETS = fileURLToPath(new URL("../../../assets/", import.meta.url));
const GENERATED = join(ASSETS, ".generated");
const VARIANT = /-\d+\.(?:avif|webp)$/u;

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]),
    ),
  );
  return nested.flat();
}

export function media(): AstroIntegration {
  return {
    name: "deq-media",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const variants = [
          ...(await walk(join(GENERATED, "images"))),
          ...(await walk(join(GENERATED, "video"))),
        ].filter((f) => VARIANT.test(f));
        if (variants.length === 0) {
          const message = "assets/.generated is missing: run `just media` to show the story images";
          if (process.env["DEQ_REQUIRE_MEDIA"] === "1") throw new Error(message);
          logger.warn(message);
          return;
        }
        const animations = (await walk(join(ASSETS, "video"))).filter(
          (f) => f.endsWith(".webp") && !f.endsWith("-poster.webp"),
        );
        const out = join(fileURLToPath(dir), "media");
        const copies = [
          ...variants.map((f) => [f, join(out, relative(GENERATED, f))] as const),
          ...animations.map((f) => [f, join(out, relative(ASSETS, f))] as const),
        ];
        await Promise.all(
          copies.map(async ([from, to]) => {
            await mkdir(dirname(to), { recursive: true });
            await copyFile(from, to);
          }),
        );
        logger.info(`copied ${String(copies.length)} media files`);
      },
    },
  };
}
