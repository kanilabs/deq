/** The press kit ZIP (Phase 12, ADR 0023). */
import type { APIRoute } from "astro";

import { pressKit } from "../../lib/brandkit.ts";

export const GET: APIRoute = async () =>
  new Response(new Uint8Array(await pressKit()), {
    headers: { "Content-Type": "application/zip" },
  });
