/**
 * Build-time images drawn from the spec: Open Graph cards and the web app icons, rasterised
 * with the exporters' resvg WASM. They carry no text (resvg has no fonts here); the title is
 * in the page's og:title.
 */
import { render, renderFlag } from "@0xdolan/deq-core";
import { encodeSvg } from "@0xdolan/deq-exporters";

import logo from "../../../../assets/brand/logo.svg?raw";
import markDark from "../../../../assets/brand/mark-small-dark.svg?raw";
import mark from "../../../../assets/brand/mark-small.svg?raw";

const BG = "#17181c";
const ICON = "#8fdba5";
/** The Kanî badge face (ADR 0013). */
const FACE = "#F8F8F8";

/** A brand SVG without its generated-file comment, placed at (x, y) and resized. */
const place = (svg: string, x: number, y: number, size: number) =>
  svg
    .replace(/^<!--[\s\S]*?-->\s*/u, "")
    .replace(
      /<svg ([^>]*?)width="\d+" height="\d+"/u,
      `<svg $1x="${String(x)}" y="${String(y)}" width="${String(size)}" height="${String(size)}"`,
    );

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
${place(markDark, 1080, 510, 72)}
</svg>`;
  // Copied into a plain ArrayBuffer so it is a valid Response body.
  return new Uint8Array(await encodeSvg(svg, 1200, "png"));
}

/**
 * A square app icon. The plain icon is the Kanî badge; the maskable one (also used for iOS)
 * fills the square with the badge face and keeps the rosette inside the 80% safe circle.
 */
export async function appIcon(size: number, maskable: boolean): Promise<Uint8Array<ArrayBuffer>> {
  const svg = maskable
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="0 0 100 100">
<rect width="100" height="100" fill="${FACE}"/>
${place(mark, 18, 18, 64)}
</svg>`
    : place(logo, 0, 0, size);
  return new Uint8Array(await encodeSvg(svg, size, "png"));
}
