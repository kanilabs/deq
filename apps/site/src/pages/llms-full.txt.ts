import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import { BASE } from "../lib/base.ts";

import { englishDocs, llmsTxt } from "../lib/llms.ts";

export const GET: APIRoute = async ({ site }) => {
  const docs = englishDocs(await getCollection("docs"));
  return new Response(llmsTxt(new URL(BASE, site).href, true, docs), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
