/**
 * Data for the story and sources pages (ADR 0018): the bibliography
 * (`content/sources.json`), the image manifest (`assets/source-manifest.json`) and the
 * captions in `content/story/images.json`. Image variants are built by
 * `deq-assets variants` and copied to `media/` by the `media` integration.
 */
import sourceList from "../../../../content/sources.json";
import captionFile from "../../../../content/story/images.json";
import manifestFile from "../../../../assets/source-manifest.json";
import { formatNumber, type Locale } from "../i18n/index.ts";
import { BASE } from "./base.ts";

export interface Source {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly author?: readonly { family?: string; given?: string; literal?: string }[];
  readonly "container-title"?: string;
  readonly publisher?: string;
  readonly "publisher-place"?: string;
  readonly volume?: string | number;
  readonly issue?: string | number;
  readonly issued?: { "date-parts": readonly (readonly number[])[] };
  readonly URL?: string;
  readonly language?: string;
  readonly custom: {
    readonly group: string;
    readonly status: string;
    readonly archiveUrl?: string;
    readonly youtubeId?: string;
    readonly notes?: string;
  };
}

export interface Asset {
  readonly id: string;
  readonly kind: string;
  readonly file: string;
  readonly subject: string;
  readonly credit: string;
  readonly attribution: string;
  readonly attributionNote?: string;
  readonly sourceId: string | null;
  readonly sourceUrl: string | null;
  readonly rights: string;
  readonly usedIn: readonly string[];
  readonly master: { readonly width: number; readonly height: number };
}

type Text = Readonly<Record<Locale, string>>;

export const SOURCES: readonly Source[] = sourceList;
export const ASSETS: readonly Asset[] = manifestFile.assets;
const CAPTIONS = captionFile.images as Readonly<Record<string, { caption: Text; alt: Text }>>;

/** Source groups in page order. */
export const GROUPS = [
  "articles",
  "academic",
  "photo-essays",
  "video",
  "social",
  "archives",
] as const;

/** Story chapter slugs in reading order; content files are `NN-<slug>.mdx`. */
export const CHAPTERS = [
  "name",
  "origins",
  "making",
  "meanings",
  "regions",
  "decline",
  "revival",
  "kobani",
  "screen",
] as const;
export type Chapter = (typeof CHAPTERS)[number];

export const CC_BY_NC_SA = "https://creativecommons.org/licenses/by-nc-sa/2.0/";

export function sourceOf(id: string): Source {
  const source = SOURCES.find((s) => s.id === id);
  if (source === undefined) throw new Error(`Unknown source: ${id}`);
  return source;
}

/** The global citation number: the source's position in `sources.json`, from 1. */
export function sourceNumber(id: string): number {
  const index = SOURCES.findIndex((s) => s.id === id);
  if (index < 0) throw new Error(`Unknown source: ${id}`);
  return index + 1;
}

export const citeLabel = (locale: Locale, id: string): string =>
  formatNumber(locale, sourceNumber(id));

export function assetOf(id: string): Asset {
  const asset = ASSETS.find((a) => a.id === id);
  if (asset === undefined) throw new Error(`Unknown image: ${id}`);
  return asset;
}

export function captionOf(id: string, locale: Locale): { caption: string; alt: string } {
  const entry = CAPTIONS[id];
  if (entry === undefined) throw new Error(`No caption for image: ${id}`);
  return { caption: entry.caption[locale], alt: entry.alt[locale] };
}

/** Variant widths written by `deq-assets variants` for a master of this width. */
export function variantWidths(width: number): number[] {
  const widths = [480, 960, 1600, 2400].filter((w) => w < width);
  widths.push(Math.min(width, 2400));
  return [...new Set(widths)].sort((a, b) => a - b);
}

export interface Picture {
  readonly avif: string;
  readonly webp: string;
  /** The largest WebP variant, for the lightbox and the no-JS link. */
  readonly large: string;
  /** The smallest WebP variant, as the `<img>` fallback. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** For animations: the animated master (the variants are of its poster). */
  readonly animated?: string;
}

/** Published URLs (under `media/`) and size of an image's variants. */
export function pictureOf(asset: Asset, base: string = BASE): Picture {
  const animated = asset.kind === "animation";
  const stem = asset.file.replace(/\.webp$/u, animated ? "-poster" : "");
  const widths = variantWidths(asset.master.width);
  const url = (w: number, ext: string) => `${base}media/${stem}-${String(w)}.${ext}`;
  const srcset = (ext: string) => widths.map((w) => `${url(w, ext)} ${String(w)}w`).join(", ");
  const largest = widths.at(-1) ?? asset.master.width;
  const smallest = widths[0] ?? asset.master.width;
  return {
    avif: srcset("avif"),
    webp: srcset("webp"),
    large: url(largest, "webp"),
    src: url(smallest, "webp"),
    width: asset.master.width,
    height: asset.master.height,
    ...(animated ? { animated: `${base}media/${asset.file}` } : {}),
  };
}

/** Authors as written in the bibliography ("Given Family", or the literal name). */
export function authors(source: Source): string {
  return (source.author ?? [])
    .map((a) => a.literal ?? [a.given, a.family].filter(Boolean).join(" "))
    .join(", ");
}

/** The issued year (or full date) as `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
export function issued(source: Source): string | undefined {
  const parts = source.issued?.["date-parts"][0];
  if (parts === undefined || parts.length === 0) return undefined;
  return parts.map((p, i) => (i === 0 ? String(p) : String(p).padStart(2, "0"))).join("-");
}

/** Chapter slugs (in order) whose MDX body cites a source. */
export function citedIn(bodies: Readonly<Partial<Record<Chapter, string>>>, id: string): Chapter[] {
  return CHAPTERS.filter((chapter) => citeIds(bodies[chapter] ?? "").has(id));
}

/** Every source id in a chapter's `<Cite ids="…" />` tags. */
export function citeIds(body: string): Set<string> {
  const ids = new Set<string>();
  for (const match of body.matchAll(/<Cite ids="([^"]+)"/gu)) {
    for (const id of (match[1] ?? "").split(/\s+/u)) if (id !== "") ids.add(id);
  }
  return ids;
}

/** The chapter slug of a content entry id such as `ckb/03-making`. */
export function chapterOf(entryId: string): { locale: string; chapter: Chapter } {
  const match = /^(\w+)\/\d\d-([a-z]+)$/u.exec(entryId);
  const chapter = match?.[2];
  if (match === null || !(CHAPTERS as readonly string[]).includes(chapter ?? "")) {
    throw new Error(`Unexpected story entry: ${entryId}`);
  }
  return { locale: match[1] ?? "", chapter: chapter as Chapter };
}

/** The locale of a page from its URL path (`/deq/ckb/story/…` → `ckb`). */
export function localeFromPath(pathname: string, base: string = BASE): Locale {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const first = rest.split("/")[0];
  return first === "ckb" || first === "kmr" ? first : "en";
}

const figured = new WeakSet<object>();

/** True for the first `<Figure>` rendered for a page request, false afterwards. */
export function isFirstFigure(request: object): boolean {
  if (figured.has(request)) return false;
  figured.add(request);
  return true;
}

/** `sizes` of a figure in the text column; `<Gallery>` swaps it for a grid cell's size. */
export const FIGURE_SIZES = "(min-width: 72rem) 45rem, 100vw";
const TILE_SIZES = "(min-width: 72rem) 15rem, 50vw";

/** Rewrite the `sizes` of figures rendered inside a gallery to the grid cell's size. */
export const tileSizes = (html: string): string => html.replaceAll(FIGURE_SIZES, TILE_SIZES);
