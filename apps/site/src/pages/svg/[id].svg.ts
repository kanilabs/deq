/** Static SVG downloads: `/svg/<id>.svg`, the default render at 24 px. */
import { render } from "@0xdolan/deq-core";
import type { APIRoute, GetStaticPaths } from "astro";

import { SHAPES } from "../../lib/data.ts";

export const getStaticPaths = (() =>
  SHAPES.map((shape) => ({ params: { id: shape.id } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(`${render(String(params["id"]))}\n`, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
  });
