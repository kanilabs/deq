/** `favicon.ico` (16, 32 and 48 px) for browsers and tools that ask for it (Phase 12, ADR 0023). */
import type { APIRoute } from "astro";

import { faviconIco } from "../lib/brandkit.ts";

export const GET: APIRoute = async () =>
  new Response(new Uint8Array(await faviconIco()), {
    headers: { "Content-Type": "image/vnd.microsoft.icon" },
  });
