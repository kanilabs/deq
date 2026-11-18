/**
 * Build-time images drawn from the spec: Open Graph cards and the web app icons, rasterised
 * with the exporters' resvg WASM. They carry no text (resvg has no fonts here); the title is
 * in the page's og:title.
 */
import { render, renderFlag } from "@0xdolan/deq-core";
import { encodeSvg } from "@0xdolan/deq-exporters";

import mark from "../assets/mark-dark.svg?raw";

const BG = "#17181c";
const ICON = "#8fdba5";

/** The chin mark's inner drawing, recoloured. */
const markBody = (color: string) =>
  mark
    .replace(/^<svg[^>]*>/u, "")
    .replace(/<\/svg>\s*$/u, "")
    .replaceAll("#8fdba5", color);

const nested = (svg: string, x: number, y: number) =>
  svg.replace("<svg ", `<svg x="${String(x)}" y="${String(y)}" `);

/** A 1200 x 630 share card: a flag strip, the page's shape (`"flag"` for the flag) and the mark. */
export async function ogImage(shapeId: string | undefined): Promise<Uint8Array<ArrayBuffer>> {
  const art =
    shapeId === "flag"
      ? nested(renderFlag({ width: 540, title: "" }), 330, 135)
      : nested(render(shapeId ?? "kurdish-sun", { size: 360, color: ICON, title: "" }), 420, 150);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${BG}"/>
<rect width="400" height="12" fill="#ED2024"/><rect x="400" width="400" height="12" fill="#FFFFFF"/><rect x="800" width="400" height="12" fill="#278E43"/>
${art}
<svg x="1080" y="510" width="72" height="72" viewBox="0 0 24 24" fill="none">${markBody(ICON)}</svg>
</svg>`;
  // Copied into a plain ArrayBuffer so it is a valid Response body.
  return new Uint8Array(await encodeSvg(svg, 1200, "png"));
}

/** A square app icon. `maskable` keeps the mark inside the 80% safe zone on a full bleed. */
export async function appIcon(size: number, maskable: boolean): Promise<Uint8Array<ArrayBuffer>> {
  const inset = maskable ? 0.25 : 0.12;
  const box = 24 / (1 - 2 * inset);
  const offset = -(box - 24) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="${String(offset)} ${String(offset)} ${String(box)} ${String(box)}">
<rect x="${String(offset)}" y="${String(offset)}" width="${String(box)}" height="${String(box)}" ${maskable ? "" : `rx="${String(box * 0.2)}" `}fill="#1d6b33"/>
<g fill="none">${markBody("#ffffff")}</g>
</svg>`;
  return new Uint8Array(await encodeSvg(svg, size, "png"));
}
