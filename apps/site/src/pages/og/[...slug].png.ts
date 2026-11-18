/** Open Graph images: one per page and one per icon (`src/lib/og.ts` maps paths to slugs). */
import type { APIRoute, GetStaticPaths } from "astro";

import { SHAPES } from "../../lib/data.ts";
import { ogImage } from "../../lib/images.ts";
import { OG_PAGES } from "../../lib/og.ts";

export const getStaticPaths = (() => [
  ...OG_PAGES.map((slug) => ({
    params: { slug },
    props: { shape: slug === "flag" ? "flag" : undefined },
  })),
  ...SHAPES.map((s) => ({ params: { slug: `icons/${s.id}` }, props: { shape: s.id } })),
]) satisfies GetStaticPaths;

export const GET: APIRoute<{ shape: string | undefined }> = async ({ props }) =>
  new Response(await ogImage(props.shape), { headers: { "Content-Type": "image/png" } });
