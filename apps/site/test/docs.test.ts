/**
 * The docs read from the repository's `docs/` folder (ADR 0020): link rewriting, sidebar
 * links, and checks over the Markdown itself (frontmatter, relative links, the three guide
 * sets, screenshots).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { docsLinks, frontmatter } from "../integrations/docs-sidebar.ts";
import {
  docId,
  type LinkContext,
  REPO_BLOB,
  repoPath,
  rewriteDocLinks,
  rewriteLink,
  SITE_URL,
} from "../src/lib/doclinks.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DOCS = join(ROOT, "docs");
const SCREENS = join(ROOT, "apps/site/public/screens");
const LOCALES = ["ckb", "kmr"] as const;

const ctx: LinkContext = {
  source: "docs/guide/studio.md",
  routes: new Map([
    ["docs/guide/exporting.md", "docs/guide/exporting/"],
    ["docs/ckb/guide/studio.md", "ckb/docs/guide/studio/"],
  ]),
  base: "/deq/",
};

describe("docId", () => {
  it("puts the locale first and drops index", () => {
    expect(docId("guide/studio.md")).toBe("docs/guide/studio");
    expect(docId("ckb/guide/Studio.md")).toBe("ckb/docs/guide/studio");
    expect(docId("index.md")).toBe("docs");
    expect(docId("kmr/index.md")).toBe("kmr/docs");
    expect(docId("dev/cli.mdx")).toBe("docs/dev/cli");
  });

  it("gives repository paths of collection files", () => {
    expect(repoPath("../../docs/guide/studio.md")).toBe("docs/guide/studio.md");
  });
});

describe("rewriteLink", () => {
  it("maps site URLs to the base", () => {
    expect(rewriteLink(`${SITE_URL}studio/`, ctx)).toBe("/deq/studio/");
  });

  it("leaves anchors, absolute paths and other schemes alone", () => {
    for (const v of ["", "#top", "/deq/icons/", "https://example.org/", "mailto:a@b.c"]) {
      expect(rewriteLink(v, ctx)).toBe(v);
    }
  });

  it("maps published docs to their routes, keeping the hash", () => {
    expect(rewriteLink("exporting.md#formats", ctx)).toBe("/deq/docs/guide/exporting/#formats");
    expect(rewriteLink("../ckb/guide/studio.md", ctx)).toBe("/deq/ckb/docs/guide/studio/");
  });

  it("serves public files from the base", () => {
    expect(rewriteLink("../../apps/site/public/screens/a.webp", ctx)).toBe("/deq/screens/a.webp");
  });

  it("links other repository files on GitHub", () => {
    expect(rewriteLink("../../spec/flag.json", ctx)).toBe(`${REPO_BLOB}spec/flag.json`);
    expect(rewriteLink("../decisions/?x=1", ctx)).toBe(`${REPO_BLOB}docs/decisions?x=1`);
  });

  it("leaves paths outside the repository alone", () => {
    expect(rewriteLink("../../../x.md", ctx)).toBe("../../../x.md");
  });
});

describe("rewriteDocLinks", () => {
  it("rewrites relative href, src and srcset values only", () => {
    const html =
      '<a href="exporting.md">x</a><a href="/deq/">h</a><a href="#a">a</a>' +
      '<img src="../../apps/site/public/screens/a.webp">' +
      '<source srcset="../../apps/site/public/screens/b.webp 2x, /c.webp 1x">' +
      `<a href="${SITE_URL}leet/">l</a>`;
    expect(rewriteDocLinks(html, ctx)).toBe(
      '<a href="/deq/docs/guide/exporting/">x</a><a href="/deq/">h</a><a href="#a">a</a>' +
        '<img src="/deq/screens/a.webp">' +
        '<source srcset="/deq/screens/b.webp 2x, /c.webp 1x">' +
        '<a href="/deq/leet/">l</a>',
    );
  });

  it("keeps absolute URLs in the head", () => {
    const head = `<head><link rel="canonical" href="${SITE_URL}docs/"/></head>`;
    expect(rewriteDocLinks(`${head}<body><a href="${SITE_URL}x/">x</a>`, ctx)).toBe(
      `${head}<body><a href="/deq/x/">x</a>`,
    );
  });
});

describe("frontmatter", () => {
  it("reads the title and sidebar order", () => {
    expect(frontmatter('---\ntitle: "Studio"\nsidebar:\n  order: 2\n---\n')).toEqual({
      title: "Studio",
      order: 2,
    });
    expect(frontmatter("---\ntitle: A\n---\n").order).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects files without frontmatter or title", () => {
    expect(() => frontmatter("# A")).toThrow("missing frontmatter");
    expect(() => frontmatter("---\ndescription: x\n---\n")).toThrow("missing title");
  });
});

describe("docsLinks", () => {
  it("orders the guides and carries both translations", () => {
    const links = docsLinks("guide");
    expect(links[0]?.link).toBe("/docs/guide/getting-started/");
    for (const link of links) expect(Object.keys(link.translations).sort()).toEqual(["ckb", "kmr"]);
  });
});

/** Markdown files under `docs/<dir>` (not recursive). */
function md(dir: string): string[] {
  const path = join(DOCS, dir);
  return existsSync(path)
    ? readdirSync(path)
        .filter((f) => f.endsWith(".md"))
        .sort()
    : [];
}

const published = [
  "index.md",
  ...LOCALES.map((l) => `${l}/index.md`),
  ...["guide", "dev", ...LOCALES.map((l) => `${l}/guide`)].flatMap((d) =>
    md(d).map((f) => `${d}/${f}`),
  ),
].map((f) => `docs/${f}`);

/** Relative link targets of a Markdown file, outside code. */
function links(source: string): string[] {
  const text = source.replace(/```[\s\S]*?```/gu, "").replace(/`[^`\n]*`/gu, "");
  const out = [...text.matchAll(/\]\(([^)\s]+)\)/gu)].map((m) => m[1] ?? "");
  for (const m of text.matchAll(/\s(?:src|srcset)="([^"]+)"/gu)) {
    out.push(...(m[1] ?? "").split(",").map((p) => p.trim().split(/\s+/u)[0] ?? ""));
  }
  return out.filter(
    (v) => v !== "" && !v.startsWith("#") && !v.startsWith("/") && !/^[a-z][a-z\d+.-]*:/iu.test(v),
  );
}

describe("docs in the repository", () => {
  const files = [...published, "README.md"];
  const read = (f: string) => readFileSync(join(ROOT, f), "utf8");

  it.each(published)("%s has a title and description", (file) => {
    const source = read(file);
    expect(frontmatter(source).title).not.toBe("");
    expect(source).toMatch(/^---\n[\s\S]*?^description: \S/mu);
  });

  it.each(files)("%s links only to files that exist", (file) => {
    const missing = links(read(file)).filter((link) => {
      const target = join(ROOT, dirname(file), decodeURI(link.split(/[?#]/u)[0] ?? ""));
      return !existsSync(target);
    });
    expect(missing).toEqual([]);
  });

  it("has the same guides in English, Sorani and Kurmanji", () => {
    for (const locale of LOCALES) expect(md(`${locale}/guide`)).toEqual(md("guide"));
  });

  it.each(LOCALES)("marks the %s docs as drafts and links the localized site", (locale) => {
    for (const file of published.filter((f) => f.startsWith(`docs/${locale}/`))) {
      const source = read(file);
      expect(source, file).toMatch(/^> .*github\.com\/kanilabs\/deq\/issues/mu);
      const site = [...source.matchAll(/https:\/\/kanilabs\.github\.io\/deq\/([^)\s"]*)/gu)].map(
        (m) => m[1] ?? "",
      );
      expect(
        site.filter((p) => !p.startsWith(`${locale}/`)),
        file,
      ).toEqual([]);
    }
  });

  it("uses every screenshot, in light and dark", () => {
    const used = new Set(
      files.flatMap((f) =>
        links(read(f)).map((l) => posix.normalize(posix.join(posix.dirname(f), l))),
      ),
    );
    const shots = readdirSync(SCREENS).filter((f) => statSync(join(SCREENS, f)).isFile());
    expect(shots.filter((s) => !used.has(`apps/site/public/screens/${s}`))).toEqual([]);
    for (const s of shots)
      expect(shots).toContain(
        s.replace(
          /-(light|dark)\.webp$/u,
          (_, t: string) => `-${t === "light" ? "dark" : "light"}.webp`,
        ),
      );
  });
});
