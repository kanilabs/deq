/**
 * Builds the service worker with Workbox after Astro has written the site (ADR 0012).
 * Every page, style, script, font and icon is precached, so the whole site (Icons and
 * Docs included) works offline. The worker waits for the page's update prompt
 * (`src/components/PwaUpdate.astro`) before it takes over.
 */
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";
import { generateSW } from "workbox-build";

/** The largest single file Workbox may precache. */
const MAX_FILE = 2 * 1024 * 1024;

export function pwa(): AstroIntegration {
  let base = "/";
  return {
    name: "deq-pwa",
    hooks: {
      "astro:config:done": ({ config }) => {
        base = config.base.endsWith("/") ? config.base : `${config.base}/`;
      },
      "astro:build:done": async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const { count, size, warnings } = await generateSW({
          globDirectory: out,
          globPatterns: ["**/*.{html,css,js,svg,png,woff2,webmanifest,txt}"],
          // Open Graph images are only for link previews; search indexes load on demand.
          globIgnores: ["og/**", "pagefind/**", "sw.js"],
          swDest: `${out}/sw.js`,
          modifyURLPrefix: { "": base },
          maximumFileSizeToCacheInBytes: MAX_FILE,
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          inlineWorkboxRuntime: true,
          mode: "production",
          sourcemap: false,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith(`${base}pagefind/`),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "deq-search", expiration: { maxEntries: 200 } },
            },
          ],
        });
        for (const warning of warnings) logger.warn(warning);
        logger.info(
          `service worker precaches ${String(count)} files (${(size / 1024 / 1024).toFixed(1)} MB)`,
        );
      },
    },
  };
}
