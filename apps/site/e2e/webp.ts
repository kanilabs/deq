/**
 * WebP encoding in Chromium through a canvas, so the screenshot scripts need no image
 * library (ADR 0019, ADR 0020).
 */
import type { Page } from "@playwright/test";

/** Encode a PNG as WebP at `width` pixels wide, keeping the aspect ratio. */
export async function encodeWebp(
  page: Page,
  png: Buffer,
  width: number,
  quality = 0.8,
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    async ({ src, width, quality }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((image.naturalHeight * width) / image.naturalWidth);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2d context");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", quality);
    },
    { src: `data:image/png;base64,${png.toString("base64")}`, width, quality },
  );
  if (!dataUrl.startsWith("data:image/webp;base64,")) throw new Error("WebP encoding failed");
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}
