/**
 * Starlight route middleware (ADR 0020): docs pages get previous and next links between
 * docs pages only. Pagination stays off for the site's own pages.
 */
import { defineRouteMiddleware, type StarlightRouteData } from "@astrojs/starlight/route-data";

type Entry = StarlightRouteData["sidebar"][number];
type Link = Extract<Entry, { type: "link" }>;

const DOCS_ID = /^(?:(?:ckb|kmr)\/)?docs(?:\/|$)/u;

function links(entries: readonly Entry[]): Link[] {
  return entries.flatMap((e) => (e.type === "link" ? [e] : links(e.entries)));
}

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  if (!DOCS_ID.test(route.id)) return;
  const docs = links(route.sidebar).filter((l) => l.href.includes("/docs/"));
  const i = docs.findIndex((l) => l.isCurrent);
  if (i === -1) return;
  route.pagination = { prev: docs[i - 1], next: docs[i + 1] };
});
