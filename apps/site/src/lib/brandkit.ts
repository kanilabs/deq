/**
 * The brand kit and the press kit (Phase 12, ADR 0023), built at build time from the generated
 * files in `assets/brand/` (`just brand`), the logo videos in `public/brand/` (`just brand-video`)
 * and the store screenshots in `public/store/` (`just store`). PNGs are rasterised with the
 * exporters' resvg, like the app icons.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { listShapes } from "@0xdolan/deq-core";
import { FORMATS, encodeSvg, packIco } from "@0xdolan/deq-exporters";

import brandJson from "../../../../assets/brand/brand.json?raw";
import tokensCss from "../../../../assets/brand/tokens.css?raw";
import { LOCALE_INFO, LOCALES } from "../i18n/index.ts";
import { zip, type ZipEntry } from "../studio/zip.ts";
import { appIcon } from "./images.ts";

const PREFIX = "../../../../assets/brand/";

/** Every brand SVG by its path in `assets/brand/` (the old logo concepts are left out). */
export const BRAND_SVGS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>(
      ["../../../../assets/brand/*.svg", "../../../../assets/brand/{lockups,guide}/*.svg"],
      { eager: true, query: "?raw", import: "default" },
    ),
  ).map(([path, svg]) => [path.slice(PREFIX.length), svg]),
);

const svgOf = (name: string): string => {
  const svg = BRAND_SVGS[name];
  if (svg === undefined) throw new Error(`assets/brand/${name} is missing: run \`just brand\``);
  return svg;
};

const widthOf = (svg: string): number => Number(/<svg [^>]*?width="([\d.]+)"/u.exec(svg)?.[1]);

/** A brand SVG's drawn size in px, for `<img width height>`. */
export function svgSize(name: string): { readonly width: number; readonly height: number } {
  const svg = svgOf(name);
  const height = Number(/<svg [^>]*?height="([\d.]+)"/u.exec(svg)?.[1]);
  return { width: widthOf(svg), height };
}

/** The PNGs served at `/brand/<name>.png` and put in the kits: source SVG and pixel width. */
export const BRAND_PNGS: Readonly<
  Record<string, { readonly svg: string; readonly width: number }>
> = {
  "logo-1024": { svg: "logo.svg", width: 1024 },
  "logo-512": { svg: "logo.svg", width: 512 },
  "logo-256": { svg: "logo.svg", width: 256 },
  "mark-512": { svg: "mark.svg", width: 512 },
  "mark-dark-512": { svg: "mark-dark.svg", width: 512 },
  "mark-flag-512": { svg: "mark-flag.svg", width: 512 },
  "social-preview": { svg: "social-preview.svg", width: 1280 },
  banner: { svg: "banner.svg", width: 1280 },
  "banner-dark": { svg: "banner-dark.svg", width: 1280 },
  "figma-cover": { svg: "figma-cover.svg", width: 1920 },
  ...Object.fromEntries(
    Object.keys(BRAND_SVGS)
      .filter((name) => name.startsWith("lockups/") && !name.includes("-mono"))
      .map((name) => {
        const id = name.slice("lockups/".length, -".svg".length);
        // Twice the drawn size: 320 px tall for the horizontal lockups.
        return [`lockup-${id}`, { svg: name, width: Math.round(widthOf(svgOf(name)) * 2) }];
      }),
  ),
};

const pngCache = new Map<string, Promise<Uint8Array>>();

/** One of `BRAND_PNGS`, rendered once per build. */
export function brandPng(name: string): Promise<Uint8Array> {
  const spec = BRAND_PNGS[name];
  if (spec === undefined) throw new Error(`no brand PNG ${name}`);
  let png = pngCache.get(name);
  if (png === undefined) {
    png = encodeSvg(svgOf(spec.svg), spec.width, "png");
    pngCache.set(name, png);
  }
  return png;
}

/** `favicon.ico` with 16, 32 and 48 px PNG entries drawn from the small mark. */
export async function faviconIco(): Promise<Uint8Array> {
  const mark = svgOf("mark-small.svg");
  const images = await Promise.all(
    [16, 32, 48].map(async (size) => ({ size, png: await encodeSvg(mark, size, "png") })),
  );
  return packIco(images);
}

/** A file next to the site (`public/...`), or an error that names the recipe that makes it. */
async function publicFile(path: string, recipe: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(resolve("public", path)));
  } catch {
    throw new Error(`public/${path} is missing: run \`${recipe}\``);
  }
}

const SITE = "https://kanilabs.github.io/deq/";
const REPO = "https://github.com/kanilabs/deq";
/** One fixed time, so the ZIPs are the same on every build. */
const DATE = new Date(2026, 0, 1);

const WEBMANIFEST = `${JSON.stringify(
  {
    name: "Deq",
    short_name: "Deq",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    background_color: "#17181c",
    theme_color: "#1d6b33",
    display: "standalone",
  },
  null,
  2,
)}\n`;

const HEAD = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
`;

const LICENSE_NOTE = `Licence and use
---------------
The Deq logo (the Dot rosette in the Kani badge) and every file here are part of Deq,
${REPO}, licensed under the GNU General Public License v3.0 or later.
The wordmarks are outlines of Noto Sans and Vazirmatn (SIL Open Font License 1.1).
A request, not a licence term: when you refer to Deq, keep the logo's colours, proportions
and dots as they are, and do not suggest that Deq endorses you. The brand guide is at
${SITE}brand/.
`;

const KIT_README = `Deq brand kit
=============

The Deq logo is the Dot rosette: eight dots around a sun ring, from the traditional Kurdish
tattoo motif. The brand guide, with clear space, minimum sizes and do's and don'ts, is at
${SITE}brand/.

svg/         every logo, mark, lockup, banner and guide drawing (the source files)
svg/lockups/ horizontal and stacked lockups, Latin (Deq) and Sorani (دەق), in five colourways:
             color (light backgrounds), reversed (dark), mono (currentColor), white, flag
png/         the logo, marks, lockups, banners, social preview and Figma cover as PNG
favicon/     favicon.ico (16, 32, 48), favicon.svg (follows the dark mode), the app icons and
             site.webmanifest; head.html has the tags
animation/   the animated logo as SVG (CSS, stays still with reduced motion), MP4 and WebM
brand.json   proportions, minimum sizes, colours (HEX, RGB, HSL, OKLCH, CMYK), typography
tokens.css   the colours as CSS custom properties

${LICENSE_NOTE}`;

/** The brand kit ZIP (`/brand/deq-brand-kit.zip`). */
export async function brandKit(): Promise<Uint8Array> {
  const entries: ZipEntry[] = [{ name: "README.txt", data: KIT_README }];
  for (const [name, svg] of Object.entries(BRAND_SVGS).sort(([a], [b]) => a.localeCompare(b))) {
    if (name.includes("-animated")) continue;
    entries.push({ name: `svg/${name}`, data: svg });
  }
  for (const name of Object.keys(BRAND_PNGS)) {
    entries.push({ name: `png/${name}.png`, data: await brandPng(name) });
  }
  entries.push(
    { name: "favicon/favicon.ico", data: await faviconIco() },
    { name: "favicon/favicon.svg", data: svgOf("favicon.svg") },
    { name: "favicon/apple-touch-icon.png", data: await appIcon(180, true) },
    { name: "favicon/icon-192.png", data: await appIcon(192, false) },
    { name: "favicon/icon-512.png", data: await appIcon(512, false) },
    { name: "favicon/maskable-512.png", data: await appIcon(512, true) },
    { name: "favicon/site.webmanifest", data: WEBMANIFEST },
    { name: "favicon/head.html", data: HEAD },
    { name: "animation/logo-animated.svg", data: svgOf("logo-animated.svg") },
    { name: "animation/mark-animated.svg", data: svgOf("mark-animated.svg") },
    {
      name: "animation/logo-animated.mp4",
      data: await publicFile("brand/logo-animated.mp4", "just brand-video"),
    },
    {
      name: "animation/logo-animated.webm",
      data: await publicFile("brand/logo-animated.webm", "just brand-video"),
    },
    { name: "brand.json", data: brandJson },
    { name: "tokens.css", data: tokensCss },
  );
  return zip(entries, DATE, { folders: true });
}

/** The store screenshots in `public/store/`, as listed in the web app manifest. */
export const STORE_SHOTS = (["home", "icons", "studio", "leet"] as const).flatMap((name) =>
  (["phone", "desktop"] as const).flatMap((form) =>
    (["light", "dark"] as const).map((theme) => ({
      name,
      form,
      theme,
      file: `store/${name}-${form}-${theme}.webp`,
    })),
  ),
);

/** The press fact sheet; the counts come from the packages, so they cannot go stale. */
export function factSheet(): string {
  const languages = LOCALES.map((l) => LOCALE_INFO[l].label).join(", ");
  return `Deq: press fact sheet
=====================

What     Traditional Kurdish tattoo (deq) motifs as an open, parametric design system.
Site     ${SITE}
Source   ${REPO}
Licence  GNU General Public License v3.0 or later (code, shapes and logo); the fonts add the
         GPL Font Exception.

In numbers
- ${String(listShapes().length)} shapes drawn on one 24-unit grid, each with its construction.
- ${String(FORMATS.length)} export formats, from SVG and PDF to PSD, icon fonts and components.
- Renderers in TypeScript, Python and Rust that match the same golden files byte for byte.
- Icon packages for React, Vue, Svelte and web components, plus icon fonts and a Leet font.
- The site, the Studio and the story in ${languages}.

Files in this kit
logos/       the logo, the horizontal lockups (light and dark) and the animated logo
screens/     the site on a phone and a desktop, light and dark
social-preview.png, logo-animated.mp4

${LICENSE_NOTE}`;
}

/** The press kit ZIP (`/brand/deq-press-kit.zip`). */
export async function pressKit(): Promise<Uint8Array> {
  const entries: ZipEntry[] = [
    { name: "fact-sheet.txt", data: factSheet() },
    { name: "logos/logo.svg", data: svgOf("logo.svg") },
    { name: "logos/logo-1024.png", data: await brandPng("logo-1024") },
    { name: "logos/logo-animated.svg", data: svgOf("logo-animated.svg") },
  ];
  for (const way of ["color", "reversed"]) {
    entries.push(
      { name: `logos/horizontal-${way}.svg`, data: svgOf(`lockups/horizontal-${way}.svg`) },
      { name: `logos/horizontal-${way}.png`, data: await brandPng(`lockup-horizontal-${way}`) },
    );
  }
  for (const shot of STORE_SHOTS) {
    entries.push({
      name: `screens/${shot.file.slice("store/".length)}`,
      data: await publicFile(shot.file, "just store"),
    });
  }
  entries.push(
    { name: "social-preview.png", data: await brandPng("social-preview") },
    {
      name: "logo-animated.mp4",
      data: await publicFile("brand/logo-animated.mp4", "just brand-video"),
    },
  );
  return zip(entries, DATE, { folders: true });
}
