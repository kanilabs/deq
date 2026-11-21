/** Brand PNGs (Phase 12, ADR 0023): banners for the READMEs, the social preview, lockups. */
import type { APIRoute, GetStaticPaths } from "astro";

import { BRAND_PNGS, brandPng } from "../../lib/brandkit.ts";

export const getStaticPaths = (() =>
  Object.keys(BRAND_PNGS).map((name) => ({ params: { name } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) =>
  new Response(new Uint8Array(await brandPng(String(params["name"]))), {
    headers: { "Content-Type": "image/png" },
  });
