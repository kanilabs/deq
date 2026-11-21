# 20. Documentation

- Status: accepted
- Date: 2026-11-19

## Context

Phase 11 documents Deq for users, developers and designers. It is split into three parts, each with its own PR: 11a covers the docs structure, screenshots, user guides and README; 11b covers developer docs and API references; 11c covers designer docs, construction pages and tool guides. The docs must read well on GitHub and on the website, in en, ckb and kmr. Every page must be reachable from the README or the sidebar, there must be no broken links, `llms.txt` must list the docs, and one command must regenerate the screenshots.

## Decision

- **One source.** The docs live in the repository's `docs/` folder, not in the site. The Starlight `docs` collection (`src/content.config.ts`) globs `../../docs` but includes only the published files: `index.md`, `{ckb,kmr}/index.md`, `{guide,dev}/**/*.md` and `{ckb,kmr}/guide/**/*.md` (`PUBLISHED` in `src/lib/doclinks.ts`). `docId` maps `guide/x.md` to `docs/guide/x` and `ckb/guide/x.md` to `ckb/docs/guide/x`, so the URLs stay under `/docs/`. Research notes, ADRs, design and font guides stay on GitHub only.
- **Links that work in both places.** Pages use plain relative Markdown links. `src/middleware.ts` runs `rewriteDocLinks` on docs pages:
  - a published doc becomes its site route, keeping the hash;
  - a file under `apps/site/public/` is served from the site base;
  - any other repository file becomes a GitHub link on `develop`;
  - absolute site URLs (`https://kanilabs.github.io/deq/…`) become base-relative.
    Starlight's own links are untouched, because only values starting with `./`, `../` or the site URL, or ending in `.md`, are rewritten.
- **Sidebar from frontmatter.** `integrations/docs-sidebar.ts` reads `title` and `sidebar.order` from each English guide and developer page, plus the ckb and kmr titles as translations. A page without frontmatter or a title fails the build. `src/routeData.ts` limits previous and next links to docs pages, so the site's own pages keep pagination off.
- **Screenshots.** `e2e/screenshots.ts` opens the built site in Playwright's Chromium at 1280 × 800, in light and dark, and in Sorani for the pages where right-to-left layout matters. Like the showcase (ADR 0019), Chromium encodes the WebP files through a canvas (`e2e/webp.ts`), so no image library is added. `just screenshots [name …]` builds the site with fonts and media, starts a preview, runs the script and stops the preview. The files go to `apps/site/public/screens/<name>-<locale>-<theme>.webp` and are committed. The guides embed them with `<picture>`, using a dark `<source>` and a light `<img>`.
- **Three languages, drafts.** Every English guide has a ckb and a kmr counterpart, with the same file name and order. Each translated page opens with a notice that it is a draft awaiting native review and links the issue tracker. UI labels are copied from the site's message catalogs. The developer pages stay English only.
- **llms.txt.** `englishDocs` in `src/lib/llms.ts` lists the English docs in sidebar order with their descriptions, in `llms.txt` and `llms-full.txt`.
- **Tool guides (11c).** Guides for Inkscape, Illustrator, Figma and similar tools say either "Verified in Inkscape 1.4" or "Based on vendor docs, not tested here", and cite the vendor pages.
- **Checks.** `test/docs.test.ts` checks:
  - the link rewriter and the sidebar;
  - that every published page has a title and a description;
  - that relative links in the docs and README resolve;
  - that the three guide sets match;
  - the draft notices and localized site links;
  - that every screenshot is used and exists in both themes.
    The built-site link check (`pnpm --filter @0xdolan/deq-site links`), the e2e page list and the Lighthouse URLs include guide pages.

## Consequences

- To add a guide, write `docs/guide/<slug>.md` with `title`, `description` and `sidebar.order`, then add the ckb and kmr drafts. The unit test fails until all three exist.
- When the UI changes, run `just screenshots` (or name the shots to redo) and commit the WebP files.
- The site build reads files outside `apps/site`. `apps/site/turbo.json` lists `docs/**` among the build inputs.
- The PWA does not precache the screenshots, story photos or the WASM encoders, so these need a connection.
- Writing the guides found two Studio bugs, fixed in 11a:
  - the dark canvas was white, because its fallback colour came from Starlight's gray scale;
  - modal dialogs sat in the top-left corner, because Starlight's reset sets `margin: 0`. The dialogs now set `margin: auto`.
