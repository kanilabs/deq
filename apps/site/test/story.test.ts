import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { LOCALES } from "../src/i18n/index.ts";
import {
  ASSETS,
  CHAPTERS,
  GROUPS,
  SOURCES,
  assetOf,
  authors,
  captionOf,
  chapterOf,
  citeIds,
  citeLabel,
  citedIn,
  isFirstFigure,
  tileSizes,
  FIGURE_SIZES,
  issued,
  localeFromPath,
  pictureOf,
  sourceNumber,
  sourceOf,
  variantWidths,
  type Chapter,
} from "../src/lib/story.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STORY = join(ROOT, "content/story");
const GENERATED = join(ROOT, "assets/.generated");
const TILE = "(min-width: 72rem) 15rem, 50vw";

interface Chapterfile {
  chapter: Chapter;
  body: string;
}

function chapters(locale: string): Chapterfile[] {
  return readdirSync(join(STORY, locale))
    .filter((f) => f.endsWith(".mdx"))
    .sort()
    .map((f) => ({
      chapter: chapterOf(`${locale}/${f.replace(/\.mdx$/u, "")}`).chapter,
      body: readFileSync(join(STORY, locale, f), "utf8"),
    }));
}

const figures = (body: string) => [...body.matchAll(/<Figure id="([^"]+)"/gu)].map((m) => m[1]);
const structure = (body: string) =>
  [...body.matchAll(/<(Figure|YouTube) id="[^"]+"|<Gallery>|<SiteLink to="[^"]+"/gu)].map(
    (m) => m[0],
  );
/** Prose blocks: paragraphs and list items outside frontmatter, headings and components. */
function prose(body: string): string[] {
  const text = body.replace(/^---\n[\s\S]*?\n---\n/u, "");
  return text
    .split(/\n\s*\n/u)
    .map((b) => b.trim())
    .filter((b) => b !== "" && !b.startsWith("#") && !b.startsWith("<"));
}

describe("story content", () => {
  it("has the same nine chapters in every locale", () => {
    for (const locale of LOCALES) {
      expect(chapters(locale).map((c) => c.chapter)).toEqual([...CHAPTERS]);
    }
  });

  it.each(LOCALES)("%s cites only known sources and cites every prose block", (locale) => {
    for (const { chapter, body } of chapters(locale)) {
      for (const id of citeIds(body)) expect(() => sourceOf(id), `${chapter}: ${id}`).not.toThrow();
      for (const block of prose(body)) {
        expect(
          /<Cite |<SiteLink /u.test(block),
          `${locale}/${chapter}: ${block.slice(0, 80)}`,
        ).toBe(true);
      }
      expect(body).toMatch(/^---\ntitle: .+\ndescription: .+\n---\n/u);
    }
  });

  it("keeps the figures, videos, links and citations of English in every translation", () => {
    const en = chapters("en");
    for (const locale of LOCALES) {
      chapters(locale).forEach(({ chapter, body }, i) => {
        const ref = en[i]?.body ?? "";
        expect(structure(body), `${locale}/${chapter}`).toEqual(structure(ref));
        expect([...citeIds(body)].sort(), `${locale}/${chapter}`).toEqual([...citeIds(ref)].sort());
      });
    }
  });

  it.each(LOCALES)(
    "%s uses every manifest image exactly once, in the chapter usedIn names",
    (locale) => {
      const used = chapters(locale).flatMap(({ chapter, body }) =>
        figures(body).map((id) => ({ id, chapter })),
      );
      expect(used.map((u) => u.id).sort()).toEqual(ASSETS.map((a) => a.id).sort());
      for (const { id, chapter } of used) expect(assetOf(id ?? "").usedIn).toEqual([chapter]);
    },
  );

  it("has a caption and alt text for every image in every locale", () => {
    for (const asset of ASSETS) {
      for (const locale of LOCALES) {
        const { caption, alt } = captionOf(asset.id, locale);
        expect(caption.trim(), `${asset.id} ${locale}`).not.toBe("");
        expect(alt.trim(), `${asset.id} ${locale}`).not.toBe("");
      }
    }
    expect(() => captionOf("nope", "en")).toThrow("No caption");
  });

  it("only embeds YouTube sources", () => {
    for (const { body } of chapters("en")) {
      for (const m of body.matchAll(/<YouTube id="([^"]+)"/gu)) {
        expect(sourceOf(m[1] ?? "").custom.youtubeId).toMatch(/^[\w-]{11}$/u);
      }
    }
  });
});

describe("sources", () => {
  it("puts every source in a known group with a known status", () => {
    const statuses = ["ok", "archived", "partial", "blocked", "to-verify"];
    for (const s of SOURCES) {
      expect(GROUPS).toContain(s.custom.group);
      expect(statuses).toContain(s.custom.status);
      if (s.custom.status === "archived") expect(s.custom.archiveUrl).toMatch(/^https:\/\//u);
    }
  });

  it("numbers sources in file order", () => {
    expect(sourceNumber(SOURCES[0]?.id ?? "")).toBe(1);
    expect(citeLabel("ckb", SOURCES[11]?.id ?? "")).toBe("١٢");
    expect(() => sourceNumber("nope")).toThrow("Unknown source");
    expect(() => sourceOf("nope")).toThrow("Unknown source");
  });

  it("formats authors and dates", () => {
    expect(authors(sourceOf("dailysabah-2016"))).toBe("Gülşah Dark");
    expect(authors(sourceOf("yt-great-big-story"))).toBe("Great Big Story");
    expect(authors(sourceOf("wikipedia-deq"))).toBe("");
    expect(issued(sourceOf("dailysabah-2016"))).toBe("2016-01-13");
    expect(issued(sourceOf("de-morgan-mission"))).toBe("1894");
    expect(issued(sourceOf("yt-great-big-story"))).toBeUndefined();
    expect(
      issued({ ...sourceOf("de-morgan-mission"), issued: { "date-parts": [[]] } }),
    ).toBeUndefined();
  });

  it("finds the chapters that cite a source", () => {
    const bodies = { name: '<Cite ids="a b" />', making: '<Cite ids="b" /> <Cite ids=" c" />' };
    expect(citedIn(bodies, "b")).toEqual(["name", "making"]);
    expect(citedIn(bodies, "c")).toEqual(["making"]);
    expect(citedIn(bodies, "z")).toEqual([]);
  });
});

describe("pictures", () => {
  it("lists the widths deq-assets writes", () => {
    expect(variantWidths(400)).toEqual([400]);
    expect(variantWidths(960)).toEqual([480, 960]);
    expect(variantWidths(1360)).toEqual([480, 960, 1360]);
    expect(variantWidths(3000)).toEqual([480, 960, 1600, 2400]);
  });

  it("builds media URLs for images and animated posters", () => {
    const image = pictureOf(assetOf("fate-temel-portrait-01"), "/deq/");
    expect(image.src).toBe("/deq/media/images/story/artists/fate-temel-portrait-01-480.webp");
    expect(image.avif).toContain("fate-temel-portrait-01-960.avif 960w");
    expect(image.animated).toBeUndefined();
    const anim = pictureOf(assetOf("deq-motifs-animation-01"), "/deq/");
    expect(anim.animated).toBe("/deq/media/video/deq-motifs-animation-01.webp");
    expect(anim.src).toBe("/deq/media/video/deq-motifs-animation-01-poster-480.webp");
    expect(pictureOf(assetOf("fate-temel-portrait-01")).src.startsWith("/media/")).toBe(true);
    expect(() => assetOf("nope")).toThrow("Unknown image");
  });

  it.skipIf(!existsSync(GENERATED))("points only at variants that deq-assets wrote", () => {
    for (const asset of ASSETS) {
      const pic = pictureOf(asset, "/");
      const urls = [
        pic.src,
        pic.large,
        ...`${pic.avif}, ${pic.webp}`.split(", ").map((p) => p.split(" ")[0]),
      ];
      for (const url of urls) {
        const file = join(GENERATED, (url ?? "").replace(/^\/media\//u, ""));
        expect(existsSync(file), file).toBe(true);
      }
    }
  });
});

describe("paths", () => {
  it("reads the locale from a page path", () => {
    expect(localeFromPath("/deq/ckb/story/name/", "/deq/")).toBe("ckb");
    expect(localeFromPath("/deq/kmr/sources/", "/deq/")).toBe("kmr");
    expect(localeFromPath("/deq/story/", "/deq/")).toBe("en");
    expect(localeFromPath("/ckb/x/")).toBe("ckb");
    expect(localeFromPath("/other/ckb/", "/deq/")).toBe("en");
  });

  it("gives gallery tiles grid-sized images", () => {
    const html = `<source sizes="${FIGURE_SIZES}"><img sizes="auto, ${FIGURE_SIZES}">`;
    expect(tileSizes(html)).toBe(`<source sizes="${TILE}"><img sizes="auto, ${TILE}">`);
  });

  it("marks only the first figure of a request", () => {
    const request = {};
    expect(isFirstFigure(request)).toBe(true);
    expect(isFirstFigure(request)).toBe(false);
    expect(isFirstFigure({})).toBe(true);
  });

  it("parses story entry ids", () => {
    expect(chapterOf("ckb/03-making")).toEqual({ locale: "ckb", chapter: "making" });
    expect(() => chapterOf("en/10-nope")).toThrow("Unexpected story entry");
    expect(() => chapterOf("bad")).toThrow("Unexpected story entry");
  });
});
