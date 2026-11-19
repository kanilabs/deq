/**
 * Copies the built icon fonts (`just fonts` → `fonts/dist/`) into the site's `fonts/`
 * folder for the Fonts page specimen. They are not committed, so a build without them
 * only warns, unless `DEQ_REQUIRE_FONTS=1` (set by the Pages workflow) makes it fail.
 * Must run before the PWA integration so the fonts are precached.
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

const SOURCE = fileURLToPath(new URL("../../../fonts/dist/", import.meta.url));
const WANTED = /^(?:Deq[\w[\],-]*\.woff2|deq-(?:icons|leet)\.css)$/u;

export function fonts(): AstroIntegration {
  return {
    name: "deq-fonts",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const files = await readdir(SOURCE).then(
          (names) => names.filter((n) => WANTED.test(n)),
          (): string[] => [],
        );
        if (!files.includes("deq-icons.css")) {
          const message = "fonts/dist is missing: run `just fonts` to show the font specimen";
          if (process.env["DEQ_REQUIRE_FONTS"] === "1") throw new Error(message);
          logger.warn(message);
          return;
        }
        const out = join(fileURLToPath(dir), "fonts");
        await mkdir(out, { recursive: true });
        await Promise.all(files.map((name) => copyFile(join(SOURCE, name), join(out, name))));
        logger.info(`copied ${String(files.length)} font files`);
      },
    },
  };
}
