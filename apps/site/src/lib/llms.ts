/** `llms.txt` and `llms-full.txt` (https://llmstxt.org): a plain-text map of the site for AI tools. */
import { CATALOGS } from "../i18n/index.ts";
import { CATEGORIES, codepoint, SHAPES } from "./data.ts";

const t = CATALOGS.en;

/** One English doc page for the Docs section: its route (no base, trailing slash) and frontmatter. */
export interface DocLink {
  readonly path: string;
  readonly title: string;
  readonly description?: string | undefined;
}

/** The English docs (ids `docs` and `docs/...`) in sidebar order: overview, guides, then the rest. */
export function englishDocs(
  entries: readonly {
    id: string;
    data: {
      title: string;
      description?: string | undefined;
      sidebar: { order?: number | undefined };
    };
  }[],
): DocLink[] {
  const rank = (id: string) => (id === "docs" ? 0 : id.startsWith("docs/guide/") ? 1 : 2);
  return entries
    .filter((e) => e.id === "docs" || e.id.startsWith("docs/"))
    .sort(
      (a, b) =>
        rank(a.id) - rank(b.id) ||
        (a.data.sidebar.order ?? Infinity) - (b.data.sidebar.order ?? Infinity) ||
        a.id.localeCompare(b.id),
    )
    .map((e) => ({ path: `${e.id}/`, title: e.data.title, description: e.data.description }));
}

export function llmsTxt(origin: string, full: boolean, docs: readonly DocLink[] = []): string {
  const page = (path: string) => `${origin}${path}`;
  const lines = [
    "# Deq",
    "",
    `> ${t["site.description"]}`,
    "",
    "Deq is licensed under GPL-3.0-or-later; the fonts add the Font Exception. Sorani (ckb) and Kurmanji (kmr) translations are AI-drafted and need native review.",
    "",
    "## Pages",
    "",
    `- [${t["nav.story"]}](${page("story/")}): ${t["home.card.story"]}`,
    `- [${t["nav.icons"]}](${page("icons/")}): ${t["home.card.icons"]}`,
    `- [${t["nav.flag"]}](${page("flag/")}): ${t["home.card.flag"]}`,
    `- [${t["nav.fonts"]}](${page("fonts/")}): ${t["home.card.fonts"]}`,
    `- [${t["nav.brand"]}](${page("brand/")}): ${t["home.card.brand"]}`,
    `- [${t["nav.sources"]}](${page("sources/")})`,
    `- [${t["nav.showcase"]}](${page("showcase/")}): ${t["home.card.showcase"]}`,
    `- [${t["nav.about"]}](${page("about/")}): ${t["home.card.about"]}`,
    "",
    "## Docs",
    "",
    ...docs.map(
      (d) =>
        `- [${d.title}](${page(d.path)})${d.description === undefined ? "" : `: ${d.description}`}`,
    ),
    "",
    "## Optional",
    "",
    "- [Source code](https://github.com/kanilabs/deq)",
    `- [Full shape list](${page("llms-full.txt")})`,
  ];
  if (full) {
    lines.push("", "## Shapes", "");
    for (const category of CATEGORIES) {
      lines.push(`### ${t[`category.${category}` as keyof typeof t]}`, "");
      for (const s of SHAPES.filter((x) => x.category === category)) {
        const cp = codepoint(s.id);
        const kmr = s.names.kmr.text === null ? "" : `, Kurmanji "${s.names.kmr.text}"`;
        const ckb = s.names.ckb.text === null ? "" : `, Sorani "${s.names.ckb.text}"`;
        lines.push(
          `- [${s.names.en}](${page(`icons/${s.id}/`)}): id \`${s.id}\`${cp === undefined ? "" : `, ${cp}`}${kmr}${ckb}; tags: ${s.tags.join(", ")}`,
        );
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
