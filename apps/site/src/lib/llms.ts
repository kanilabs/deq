/** `llms.txt` and `llms-full.txt` (https://llmstxt.org): a plain-text map of the site for AI tools. */
import { CATALOGS } from "../i18n/index.ts";
import { CATEGORIES, codepoint, SHAPES } from "./data.ts";

const t = CATALOGS.en;

export function llmsTxt(origin: string, full: boolean): string {
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
    `- [${t["nav.icons"]}](${page("icons/")}): ${t["home.card.icons"]}`,
    `- [${t["nav.flag"]}](${page("flag/")}): ${t["home.card.flag"]}`,
    `- [${t["nav.fonts"]}](${page("fonts/")}): ${t["home.card.fonts"]}`,
    `- [${t["nav.brand"]}](${page("brand/")}): ${t["home.card.brand"]}`,
    `- [${t["nav.about"]}](${page("about/")}): ${t["home.card.about"]}`,
    "",
    "## Docs",
    "",
    `- [Getting started](${page("docs/")})`,
    `- [Packages](${page("docs/packages/")})`,
    `- [Command line](${page("docs/cli/")})`,
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
