/**
 * Docs from the repository's `docs/` folder (ADR 0020). The same Markdown files are read on
 * GitHub and published by Starlight, so they link with repository-relative paths
 * (`../guide/studio.md`, `../../apps/site/public/screens/studio-light-en.webp`) and the
 * middleware rewrites those links on the site. Pure functions, unit-tested in
 * `test/docs.test.ts`.
 */
import { posix } from "node:path";

/** Locales other than English; their docs live in `docs/<locale>/`. */
const LOCALE_DIRS: ReadonlySet<string> = new Set(["ckb", "kmr"]);
/** Where the live site is, so docs can link to its pages and work on GitHub too. */
export const SITE_URL = "https://kanilabs.github.io/deq/";
/** Repository files the site does not publish are linked on GitHub. */
export const REPO_BLOB = "https://github.com/kanilabs/deq/blob/develop/";
/** Files in `apps/site/public/` are served from the site's base. */
const PUBLIC_DIR = "apps/site/public/";

/** Glob patterns, relative to `docs/`, of the files the site publishes. */
export const PUBLISHED = [
  "index.md",
  "{ckb,kmr}/index.md",
  "{guide,dev,api}/**/*.md",
  "{ckb,kmr}/guide/**/*.md",
];

/**
 * Collection id of a file in `docs/`: Starlight wants the locale first, so
 * `ckb/guide/studio.md` becomes `ckb/docs/guide/studio` and `guide/studio.md`
 * becomes `docs/guide/studio`. Index files take their folder's id.
 */
export function docId(entry: string): string {
  const parts = entry
    .replace(/\.mdx?$/u, "")
    .toLowerCase()
    .split("/");
  if (parts.at(-1) === "index") parts.pop();
  const first = parts[0];
  if (first !== undefined && LOCALE_DIRS.has(first))
    return [first, "docs", ...parts.slice(1)].join("/");
  return ["docs", ...parts].join("/");
}

/** Repository path of a collection entry's `filePath` (relative to `apps/site`). */
export function repoPath(filePath: string): string {
  return posix.normalize(posix.join("apps/site", filePath));
}

export interface LinkContext {
  /** Repository path of the page's Markdown file. */
  readonly source: string;
  /** Repository path → site path (no base, trailing slash) of every published doc. */
  readonly routes: ReadonlyMap<string, string>;
  /** The site's base, with a trailing slash (`/deq/`). */
  readonly base: string;
}

const SCHEME = /^[a-z][a-z\d+.-]*:/iu;

/** The site URL of one link value, or the value unchanged. */
export function rewriteLink(value: string, ctx: LinkContext): string {
  if (value.startsWith(SITE_URL)) return ctx.base + value.slice(SITE_URL.length);
  if (value === "" || value.startsWith("#") || value.startsWith("/") || SCHEME.test(value))
    return value;
  const cut = value.search(/[?#]/u);
  const path = cut === -1 ? value : value.slice(0, cut);
  const rest = cut === -1 ? "" : value.slice(cut);
  const target = posix.normalize(posix.join(posix.dirname(ctx.source), path));
  if (target.startsWith("../")) return value;
  const route = ctx.routes.get(target);
  if (route !== undefined) return ctx.base + route + rest;
  if (target.startsWith(PUBLIC_DIR)) return ctx.base + target.slice(PUBLIC_DIR.length) + rest;
  return REPO_BLOB + target.replace(/\/$/u, "") + rest;
}

const ATTR = /\s(href|src|srcset)="([^"]*)"/gu;

/**
 * Rewrite the links of a rendered doc page. Only relative paths (`./`, `../`, or ending in
 * `.md`) and links to {@link SITE_URL} change, so Starlight's own markup is left alone.
 */
export function rewriteDocLinks(html: string, ctx: LinkContext): string {
  const relative = (v: string) =>
    v.startsWith(SITE_URL) ||
    v.startsWith("./") ||
    v.startsWith("../") ||
    /\.mdx?(?:[?#].*)?$/u.test(v);
  // The head keeps absolute URLs: canonical and hreflang links must stay absolute.
  const end = html.indexOf("</head>");
  const start = end === -1 ? 0 : end;
  return (
    html.slice(0, start) +
    html.slice(start).replace(ATTR, (match, name: string, value: string) => {
      if (name === "srcset") {
        const out = value
          .split(",")
          .map((part) => {
            const [url = "", ...descriptor] = part.trim().split(/\s+/u);
            return [relative(url) ? rewriteLink(url, ctx) : url, ...descriptor].join(" ");
          })
          .join(", ");
        return ` srcset="${out}"`;
      }
      return relative(value) ? ` ${name}="${rewriteLink(value, ctx)}"` : match;
    })
  );
}
