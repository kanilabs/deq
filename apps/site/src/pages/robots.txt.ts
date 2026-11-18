import type { APIRoute } from "astro";

import { BASE } from "../lib/base.ts";

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(`${BASE}sitemap-index.xml`, site).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
