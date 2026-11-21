/**
 * Rewrites the repository-relative links of docs pages to site URLs (ADR 0020). Runs while
 * the pages are prerendered; other pages pass through untouched.
 */
import { getCollection } from "astro:content";
import { defineMiddleware } from "astro:middleware";

import { BASE } from "./lib/base.ts";
import { repoPath, rewriteDocLinks } from "./lib/doclinks.ts";

let routes: Promise<Map<string, string>> | undefined;

/** Repository path → site path of every published doc. */
async function docRoutes(): Promise<Map<string, string>> {
  const entries = await getCollection("docs");
  return new Map(
    entries.flatMap((e) =>
      e.filePath === undefined ? [] : [[repoPath(e.filePath), `${e.id}/`] as const],
    ),
  );
}

const DOCS_PATH = /^(?:(?:ckb|kmr)\/)?docs\//u;

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const path = context.url.pathname.slice(BASE.length);
  if (!DOCS_PATH.test(path) || !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }
  // Read the body first: the page sets its route data while it renders.
  const body = await response.text();
  const { filePath } = context.locals.starlightRoute.entry;
  routes ??= docRoutes();
  const html = rewriteDocLinks(body, {
    source: repoPath(filePath),
    routes: await routes,
    base: BASE,
  });
  return new Response(html, { status: response.status, headers: response.headers });
});
