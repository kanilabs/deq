/** ICO files (PNG entries) and the favicon pack. */
import { prepare, svgDocument } from "@0xdolan/deq-core";
import type { RenderOptions } from "@0xdolan/deq-core";

import { parseColor, toHex } from "./color.js";
import type { ExportFile, Resolved } from "./input.js";
import { encodeSvg } from "./raster.js";

/** Sizes in `favicon.ico`. */
export const ICO_SIZES = [16, 32, 48] as const;

/** Pack PNG images into an ICO container (Windows Vista+ PNG entries). */
export function packIco(
  images: readonly { readonly size: number; readonly png: Uint8Array }[],
): Uint8Array {
  const header = 6 + 16 * images.length;
  const total = images.reduce((sum, i) => sum + i.png.length, header);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  let offset = header;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    out[e] = img.size >= 256 ? 0 : img.size;
    out[e + 1] = img.size >= 256 ? 0 : img.size;
    view.setUint16(e + 4, 1, true); // colour planes
    view.setUint16(e + 6, 32, true); // bits per pixel
    view.setUint32(e + 8, img.png.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.length;
  });
  return out;
}

/** Render an item at several square sizes into one ICO file. */
export async function toIco(
  r: Resolved,
  sizes: readonly number[] = ICO_SIZES,
): Promise<Uint8Array> {
  const svg = svgDocument(r.prepared);
  const images = await Promise.all(
    sizes.map(async (size) => ({ size, png: await encodeSvg(svg, size, "png") })),
  );
  return packIco(images);
}

export interface FaviconOptions {
  /** App name in `site.webmanifest`. Default: the shape's English name. */
  readonly name?: string;
  /** Short app name. Default: `name`. */
  readonly shortName?: string;
  /** Icon colour in light mode and in the PNG icons. Default: the render colour, or black. */
  readonly color?: string;
  /** Icon colour when the browser is in dark mode (`favicon.svg` only). Default white. */
  readonly darkColor?: string;
  /** Opaque background of the Apple touch and maskable icons. Default white. */
  readonly background?: string;
  /** `theme_color` in the manifest. Default: `background`. */
  readonly themeColor?: string;
}

const hex = (c: string): string => toHex(parseColor(c));

/**
 * The favicon pack: `favicon.ico` (16, 32, 48), `favicon.svg` (follows dark mode),
 * `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
 * (80% safe zone) and `site.webmanifest`. All colours are re-serialised as hex.
 */
export async function toFaviconPack(
  r: Resolved,
  options: FaviconOptions = {},
): Promise<ExportFile[]> {
  const base = r.options;
  const inherited = base.color === undefined || /^currentcolor$/i.test(base.color);
  const light = hex(options.color ?? (inherited ? "#000000" : base.color));
  const dark = hex(options.darkColor ?? "#ffffff");
  const background = hex(options.background ?? "#ffffff");
  const theme = hex(options.themeColor ?? background);
  const name = options.name ?? r.shape.names.en;

  const svgOf = (o: RenderOptions): string => svgDocument(prepare(r.shape, { ...base, ...o }));

  const transparent = svgOf({ color: light, background: "none" });
  const touch = svgOf({ color: light, background, padding: 2 });
  const maskable = svgOf({ color: light, background, padding: 3 });
  // favicon.svg keeps currentColor and sets it from CSS, so it follows the colour scheme.
  const style = `<style>:root{color:${light}}@media (prefers-color-scheme:dark){:root{color:${dark}}}</style>`;
  const scheme = svgOf({
    color: "currentColor",
    background: "none",
    title: "",
    ariaLabel: "",
  }).replace(/^(<svg [^>]*>)/, `$1${style}`);

  const icoImages = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, png: await encodeSvg(transparent, size, "png") })),
  );
  const ico = packIco(icoImages);
  const [apple, i192, i512, iMask] = await Promise.all([
    encodeSvg(touch, 180, "png"),
    encodeSvg(transparent, 192, "png"),
    encodeSvg(transparent, 512, "png"),
    encodeSvg(maskable, 512, "png"),
  ]);
  const manifest = {
    name,
    short_name: options.shortName ?? name,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    theme_color: theme,
    background_color: background,
    display: "standalone",
  };
  return [
    { name: "favicon.ico", mediaType: "image/vnd.microsoft.icon", data: ico },
    { name: "favicon.svg", mediaType: "image/svg+xml", data: scheme },
    { name: "apple-touch-icon.png", mediaType: "image/png", data: apple },
    { name: "icon-192.png", mediaType: "image/png", data: i192 },
    { name: "icon-512.png", mediaType: "image/png", data: i512 },
    { name: "icon-maskable-512.png", mediaType: "image/png", data: iMask },
    {
      name: "site.webmanifest",
      mediaType: "application/manifest+json",
      data: `${JSON.stringify(manifest, null, 2)}\n`,
    },
  ];
}
