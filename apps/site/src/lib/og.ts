/** Open Graph image paths: one per page and one per icon (built by `src/pages/og/[...slug].png.ts`). */
import { LOCALES } from "../i18n/index.ts";

/** The pages that have their own share image. */
export const OG_PAGES = ["home", "icons", "flag", "fonts", "brand", "about", "docs"] as const;

/**
 * The share image slug for a site path such as `/deq/ckb/icons/sun-rays/`.
 * Docs pages share one image; unknown pages use the home image.
 */
export function ogSlug(pathname: string, base: string): string {
  const root = base.endsWith("/") ? base : `${base}/`;
  const rest = pathname.startsWith(root)
    ? pathname.slice(root.length)
    : pathname.replace(/^\/+/u, "");
  const parts = rest.split("/").filter(Boolean);
  if ((LOCALES as readonly string[]).includes(parts[0] ?? "")) parts.shift();
  const [page, id] = parts;
  if (page === undefined) return "home";
  if (page === "icons" && id !== undefined && /^[a-z0-9-]+$/u.test(id)) return `icons/${id}`;
  return (OG_PAGES as readonly string[]).includes(page) ? page : "home";
}
