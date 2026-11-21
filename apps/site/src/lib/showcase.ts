/**
 * Data for the showcase page (ADR 0019): projects in `content/showcase.json`, with
 * screenshots in `public/showcase/` written by `e2e/shots.ts`.
 */
import showcaseFile from "../../../../content/showcase.json";
import type { Locale } from "../i18n/index.ts";
import { BASE } from "./base.ts";

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly repo?: string;
  readonly shapes: readonly string[];
  readonly description: Readonly<Record<Locale, string>>;
}

export const PROJECTS: readonly Project[] = showcaseFile.projects;

/** Screenshot widths written by `e2e/shots.ts` (viewport 1280 × 800). */
export const SHOT_WIDTHS = [640, 1280] as const;
export const SHOT_HEIGHT_RATIO = 800 / 1280;

/**
 * Sandbox of a live preview. The projects share this site's origin
 * (`kanilabs.github.io`), so `allow-same-origin` would give them this site's storage
 * and DOM: it is never granted, and previews run in an opaque origin.
 */
export const SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

/** Only https pages can be previewed. */
export function previewUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") {
    throw new Error(`Not an https preview URL: ${url}`);
  }
  return parsed.href;
}

export function screenshot(id: string, base: string = BASE): { src: string; srcset: string } {
  const url = (w: number) => `${base}showcase/${id}-${String(w)}.webp`;
  return {
    src: url(SHOT_WIDTHS[0]),
    srcset: SHOT_WIDTHS.map((w) => `${url(w)} ${String(w)}w`).join(", "),
  };
}
