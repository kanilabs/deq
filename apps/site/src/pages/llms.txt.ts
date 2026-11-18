import type { APIRoute } from "astro";

import { BASE } from "../lib/base.ts";

import { llmsTxt } from "../lib/llms.ts";

export const GET: APIRoute = ({ site }) => {
  return new Response(llmsTxt(new URL(BASE, site).href, false), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
