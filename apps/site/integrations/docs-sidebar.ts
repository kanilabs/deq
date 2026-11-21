/**
 * Sidebar links for the docs in the repository's `docs/` folder (ADR 0020). Starlight's
 * `autogenerate` only sees files under `src/content/docs`, so the links are built here from
 * each file's frontmatter: the English title, the ckb and kmr titles from their
 * translations, and `sidebar.order`.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = fileURLToPath(new URL("../../../docs/", import.meta.url));
const TRANSLATED = ["ckb", "kmr"] as const;

export interface DocMeta {
  readonly title: string;
  readonly order: number;
}

/** `title` and `sidebar.order` of a Markdown file's frontmatter. */
export function frontmatter(source: string): DocMeta {
  const block = /^---\n([\s\S]*?)\n---/u.exec(source)?.[1];
  if (block === undefined) throw new Error("missing frontmatter");
  const title = /^title:\s*(.+)$/mu
    .exec(block)?.[1]
    ?.trim()
    .replace(/^(["'])(.*)\1$/u, "$2");
  if (title === undefined || title === "") throw new Error("missing title");
  const order = /^sidebar:\s*\n\s+order:\s*(-?\d+)\s*$/mu.exec(block)?.[1];
  return { title, order: order === undefined ? Number.MAX_SAFE_INTEGER : Number(order) };
}

/** A Starlight sidebar link with its ckb and kmr labels. */
export interface DocsLink {
  readonly label: string;
  readonly translations: Record<string, string>;
  readonly link: string;
}

/** Sidebar links for every Markdown file in `docs/<dir>`, ordered by `sidebar.order`. */
export function docsLinks(dir: string, docs: string = DOCS): DocsLink[] {
  const files = readdirSync(join(docs, dir)).filter((f) => f.endsWith(".md"));
  return files
    .map((file) => {
      const meta = frontmatter(readFileSync(join(docs, dir, file), "utf8"));
      const translations: Record<string, string> = {};
      for (const locale of TRANSLATED) {
        const path = join(docs, locale, dir, file);
        if (existsSync(path)) translations[locale] = frontmatter(readFileSync(path, "utf8")).title;
      }
      const slug = file.replace(/\.md$/u, "").toLowerCase();
      return { meta, item: { label: meta.title, translations, link: `/docs/${dir}/${slug}/` } };
    })
    .sort((a, b) => a.meta.order - b.meta.order || a.meta.title.localeCompare(b.meta.title))
    .map((x) => x.item);
}
