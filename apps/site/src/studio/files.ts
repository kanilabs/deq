/**
 * Opening, saving and sharing files in the Studio (Phase 8d): which reader a file goes to,
 * size limits, and the message for each failure. The browser glue is in `Studio.svelte`.
 */
import { CustomShapeError } from "./custom.ts";
import type { StudioKey } from "./i18n.ts";
import { ShareError } from "./share.ts";
import { SVG_LIMITS, SvgImportError } from "./svgimport.ts";

/** Largest design or shape JSON file the Studio opens, in bytes. */
export const MAX_OPEN_BYTES = 1_000_000;

/** The name a saved design gets. */
export const DESIGN_FILE = "deq-design.json";

/** What a file is opened as: an SVG to import, or JSON (a design or a shape spec). */
export function fileKind(name: string, type: string): "svg" | "json" {
  return type === "image/svg+xml" || /\.svg$/iu.test(name) ? "svg" : "json";
}

/** The size limit for a file of `kind`. */
export const openLimit = (kind: "svg" | "json"): number =>
  kind === "svg" ? SVG_LIMITS.bytes : MAX_OPEN_BYTES;

/** The message key for a failed open, import or share. */
export function ioErrorKey(error: unknown): StudioKey {
  if (error instanceof SvgImportError) return `studio.io.error.${error.code}`;
  if (error instanceof ShareError) {
    return error.code === "large" ? "studio.io.error.shareLarge" : "studio.io.error.shareInvalid";
  }
  if (error instanceof CustomShapeError && error.message.startsWith("at most")) {
    return "studio.io.error.full";
  }
  // Bad JSON, an invalid design or shape (DocError, CustomShapeError) and anything else.
  return "studio.io.error.invalid";
}
