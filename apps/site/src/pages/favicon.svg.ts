/** The favicon, served from the generated brand SVG (ADR 0013); switches to the dark accent with the OS. */
import type { APIRoute } from "astro";

import favicon from "../../../../assets/brand/favicon.svg?raw";

export const GET: APIRoute = () =>
  new Response(favicon, { headers: { "Content-Type": "image/svg+xml" } });
