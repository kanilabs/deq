/** Every brand SVG at `/brand/svg/<path>.svg`, for the brand page and direct links (ADR 0023). */
import type { APIRoute, GetStaticPaths } from "astro";

import { BRAND_SVGS } from "../../../lib/brandkit.ts";

export const getStaticPaths = (() =>
  Object.keys(BRAND_SVGS).map((path) => ({
    params: { name: path.slice(0, -".svg".length) },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(BRAND_SVGS[`${String(params["name"])}.svg`], {
    headers: { "Content-Type": "image/svg+xml" },
  });
