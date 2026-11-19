/**
 * Astro hashes the scripts it bundles, but not `is:inline` scripts from Starlight's own
 * components (the theme provider and the search dialog opener), so the browser blocks
 * them under the CSP. After the build, this adds the SHA-256 hash of every inline
 * executable script to its page's `script-src` (ADR 0012). Only build output is hashed:
 * no visitor data ever reaches an inline script. Every page must already carry the CSP
 * <meta>, or the build fails. Must run before the PWA integration, which precaches the
 * final HTML.
 *
 * The Studio pages also get `'wasm-unsafe-eval'` (ADR 0014, Phase 8d): raster export
 * compiles the resvg and jSquash WebAssembly modules. It allows WebAssembly compilation
 * only, not `eval`, and no other page gets it.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

const META = /(<meta http-equiv="content-security-policy" content=")([^"]*)(")/u;
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gu;
/** Script types the browser executes (JSON-LD and other data blocks are not). */
const EXECUTABLE = /^(?:|text\/javascript|module)$/u;

const sha256 = (text: string): string =>
  `'sha256-${createHash("sha256").update(text).digest("base64")}'`;

/** Add the missing inline-script hashes to one page; returns how many were added. */
export function hashInlineScripts(html: string): { html: string; added: number } {
  const meta = META.exec(html);
  if (meta === null) throw new Error("page has no CSP <meta>");
  const policy = meta[2] ?? "";
  const missing = new Set<string>();
  for (const [, attrs = "", body = ""] of html.matchAll(INLINE_SCRIPT)) {
    const type = /\btype="([^"]*)"/u.exec(attrs)?.[1] ?? "";
    if (!EXECUTABLE.test(type)) continue;
    const hash = sha256(body);
    if (!policy.includes(hash)) missing.add(hash);
  }
  if (missing.size === 0) return { html, added: 0 };
  const extra = [...missing].join(" ");
  const updated = /(^|;)\s*script-src /u.test(policy)
    ? policy.replace(/((?:^|;)\s*script-src [^;]*)/u, `$1 ${extra}`)
    : `${policy};script-src 'self' ${extra}`;
  return { html: html.replace(META, `$1${updated}$3`), added: missing.size };
}

/** Pages that compile WebAssembly: the Studio in every locale. */
export const WASM_PAGES = /(?:^|[/\\])studio[/\\]index\.html$/u;

/** Add `source` to the page's `script-src` (once). */
export function addScriptSource(html: string, source: string): string {
  const meta = META.exec(html);
  if (meta === null) throw new Error("page has no CSP <meta>");
  const policy = meta[2] ?? "";
  const has = policy
    .split(";")
    .some((d) => d.trim().startsWith("script-src ") && d.trim().split(/\s+/u).includes(source));
  if (has) return html;
  const updated = /(^|;)\s*script-src /u.test(policy)
    ? policy.replace(/((?:^|;)\s*script-src)/u, `$1 ${source}`)
    : `${policy};script-src 'self' ${source}`;
  return html.replace(META, `$1${updated}$3`);
}

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => join(e.parentPath, e.name));
}

export function csp(): AstroIntegration {
  return {
    name: "deq-csp",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        let pages = 0;
        for (const file of await htmlFiles(fileURLToPath(dir))) {
          const original = await readFile(file, "utf8");
          const { html: hashed } = hashInlineScripts(original);
          const html = WASM_PAGES.test(file)
            ? addScriptSource(hashed, "'wasm-unsafe-eval'")
            : hashed;
          if (html !== original) {
            await writeFile(file, html);
            pages += 1;
          }
        }
        logger.info(`updated the script-src of ${String(pages)} pages`);
      },
    },
  };
}
