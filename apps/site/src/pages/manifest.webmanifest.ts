/** The web app manifest: installable on Android, iOS, desktop Chrome and Edge. */
import type { APIRoute } from "astro";

import { CATALOGS } from "../i18n/index.ts";
import { BASE } from "../lib/base.ts";
import { STORE_SHOTS } from "../lib/brandkit.ts";

const t = CATALOGS.en;

export const GET: APIRoute = () => {
  const manifest = {
    name: "Deq",
    short_name: "Deq",
    description: t["site.description"],
    lang: "en",
    dir: "ltr",
    id: BASE,
    start_url: BASE,
    scope: BASE,
    display: "standalone",
    background_color: "#17181c",
    theme_color: "#1d6b33",
    categories: ["design", "education", "utilities"],
    icons: [
      { src: `${BASE}app/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}app/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: `${BASE}app/maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: `${BASE}favicon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    // The install dialog shows these (Chrome and Edge); the light theme, phone and desktop.
    screenshots: STORE_SHOTS.filter((s) => s.theme === "light").map((s) => ({
      src: `${BASE}${s.file}`,
      sizes: s.form === "phone" ? "780x1688" : "1920x1200",
      type: "image/webp",
      form_factor: s.form === "phone" ? "narrow" : "wide",
      label: t[`brand.store.${s.name}`],
    })),
    shortcuts: [
      {
        name: t["nav.icons"],
        url: `${BASE}icons/`,
        icons: [{ src: `${BASE}app/icon-192.png`, sizes: "192x192" }],
      },
      {
        name: t["nav.docs"],
        url: `${BASE}docs/`,
        icons: [{ src: `${BASE}app/icon-192.png`, sizes: "192x192" }],
      },
    ],
  };
  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: { "Content-Type": "application/manifest+json" },
  });
};
