/**
 * Internal link check over the built site (ADR 0018): every same-site `href`, `src` and
 * `srcset` URL in `dist/**\/*.html` must resolve to a file, and every `#fragment` on a
 * same-site page must match an `id` there. External URLs are listed by
 * `node e2e/links.ts --external` for a manual check; CI never calls outside services.
 *
 *   pnpm build && node e2e/links.ts
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const BASE = "/deq/";
const ATTR = /\s(?:href|src|srcset)="([^"]*)"/gu;
const ID = /\sid="([^"]*)"/gu;

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]),
    ),
  );
  return nested.flat();
}

const decode = (s: string) => s.replaceAll("&amp;", "&");

/** Code shows markup as text (an API example's `href="…"`), so it is not a link. */
const CODE = /<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/gu;

async function fileFor(path: string): Promise<string | undefined> {
  const local = join(DIST, path.slice(BASE.length));
  const candidates = path.endsWith("/")
    ? [join(local, "index.html")]
    : [local, join(local, "index.html")];
  for (const file of candidates) {
    if (
      await stat(file).then(
        (s) => s.isFile(),
        () => false,
      )
    )
      return file;
  }
  return undefined;
}

const pages = (await walk(DIST)).filter((f) => f.endsWith(".html"));
const ids = new Map<string, Set<string>>();
const html = new Map<string, string>();
for (const page of pages) {
  const text = (await readFile(page, "utf8")).replace(CODE, "");
  html.set(page, text);
  ids.set(page, new Set([...text.matchAll(ID)].map((m) => decode(m[1] ?? ""))));
}

const broken: string[] = [];
const external = new Set<string>();
for (const [page, text] of html) {
  const here = `${BASE}${relative(DIST, page).replace(/index\.html$/u, "")}`;
  for (const match of text.matchAll(ATTR)) {
    const value = decode(match[1] ?? "");
    const urls = match[0].includes("srcset=")
      ? value.split(",").map((p) => p.trim().split(/\s+/u)[0] ?? "")
      : [value];
    for (const url of urls) {
      if (url === "" || url.startsWith("data:") || url.startsWith("mailto:")) continue;
      if (/^https?:\/\//u.test(url)) {
        external.add(url);
        continue;
      }
      const resolved = new URL(url, `http://site${here}`);
      const path = decodeURIComponent(resolved.pathname);
      const fragment = resolved.hash.slice(1);
      if (!path.startsWith(BASE)) {
        broken.push(`${relative(DIST, page)}: ${url} (not under ${BASE})`);
        continue;
      }
      const target = await fileFor(path);
      if (target === undefined) {
        broken.push(`${relative(DIST, page)}: ${url}`);
      } else if (fragment !== "" && target.endsWith(".html")) {
        if (!ids.get(target)?.has(decodeURIComponent(fragment))) {
          broken.push(`${relative(DIST, page)}: ${url} (no #${fragment})`);
        }
      }
    }
  }
}

if (process.argv.includes("--external")) {
  for (const url of [...external].sort()) console.log(url);
}
if (broken.length > 0) {
  console.error(
    `${String(broken.length)} broken internal links:\n${[...new Set(broken)].slice(0, 50).join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `ok: ${String(pages.length)} pages, internal links resolve (${String(external.size)} external URLs not checked)`,
);
