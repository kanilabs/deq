/** The Studio design and helpers shared by the screenshot, store image and clip scripts. */
import type { Page } from "@playwright/test";

/** The design the Studio screenshots open, as a share link (`#d=1.<deflate-raw, base64url>`). */
export const DESIGN = {
  v: 1,
  items: [
    { id: "a", shape: "kurdish-sun", x: 120, y: 80, options: { size: 200, color: "#c8102e" } },
    { id: "b", shape: "dot-rosette", x: 380, y: 80, options: { size: 200 } },
    { id: "c", shape: "tree-comb", x: 120, y: 330, options: { size: 200, color: "#007a3d" } },
    { id: "d", shape: "lozenge-nested", x: 380, y: 330, options: { size: 200, strokeWidth: 2.5 } },
  ],
};

export async function shareToken(doc: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(doc)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return `1.${Buffer.from(bytes).toString("base64url")}`;
}

export async function studioReady(page: Page): Promise<void> {
  await page.locator(".studio.ready").waitFor();
  await page
    .locator(".notices .notice")
    .first()
    .waitFor({ state: "attached", timeout: 2_000 })
    .catch(() => undefined);
}

export async function closeNotices(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const n of document.querySelectorAll(".notices .notice")) n.remove();
  });
}
