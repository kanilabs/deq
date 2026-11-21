# 18. Story and sources on the site

- Status: accepted
- Date: 2026-11-19

## Context

Phase 10a publishes the cultural story of deq and its sources in English, Sorani and Kurmanji. Every factual sentence must cite a source from `content/sources.json`. Every image in `assets/source-manifest.json` must appear with its caption, credit, rights and alt text. Videos must not load third-party code before a click. Links must be checked. The masters are large WebP files, so the pages need responsive variants without committing generated files.

## Decision

- **Content as MDX.** Chapters live in `content/story/<locale>/NN-<slug>.mdx` (nine chapters: name, origins, making, meanings, regions, decline, revival, kobani, screen). Astro reads them through a `story` content collection (glob loader, schema `{title, description}`). Pages are `story/` (contents) and `story/[chapter]` with previous and next links. The slug list is `CHAPTERS` in `apps/site/src/lib/story.ts`.
- **Components, not Markdown plugins.** MDX uses `<Cite ids="…" />`, `<Figure id="…" />`, `<Gallery>`, `<YouTube id="…" />` and `<SiteLink to="…" />` from `src/components/story/`. They read the locale from the URL. Astro 7's Markdown pipeline needs an extra package for remark plugins, so the site uses none. `Gallery` renders its slot and swaps the figure `sizes` for the grid cell's (`tileSizes`). This rewrites only the site's own markup.
- **Citations.** A citation number is the source's position in `sources.json`. It is the same in every chapter and locale, and it is written in the locale's digits. Each number links to `sources/#src-<id>`. The sources page lists the sources by group, with their status, archive link and the chapters that cite them. It also has a by-chapter index, image and video credit tables, and a note asking rights holders to get in touch for corrections or removal.
- **Captions apart from provenance.** Captions and alt text (en, ckb, kmr) are in `content/story/images.json`. Credit, attribution, rights and source come from the manifest, and `usedIn` names the chapter that shows each image. Inferred attributions are labelled "Attributed" and unknown ones "Source unknown". CC BY-NC-SA images link to their licence.
- **Media.** `deq-assets variants` writes AVIF and WebP variants (480, 960, 1600, 2400 px, capped at the master) to the gitignored `assets/.generated/`. The `media` integration copies them, and the animated masters, to `dist/media/`. Without variants the build warns, and with `DEQ_REQUIRE_MEDIA=1` it fails. CI, Pages and `just site` build the variants first. Only the first figure on a page loads eagerly with high priority. Later figures load lazily with `sizes="auto, …"`. Animations offer the poster to `prefers-reduced-motion`.
- **Video facade.** `<YouTube>` shows the poster and a play button. On click, a script creates a sandboxed `youtube-nocookie.com` iframe with DOM calls. The video id is checked against `^[\w-]{11}$` and must belong to a `video` source. Instagram is linked, not embedded.
- **Lightbox.** A single `<dialog>` shows the largest variant with its caption. It is filled with `textContent` and attributes, never HTML. Without JavaScript the figure link opens the image.
- **Checks.** `test/story.test.ts` checks the following:
  - the same chapters, figures, videos, links and citation ids in every locale;
  - a citation in every prose block;
  - every manifest image used exactly once per locale, in its `usedIn` chapter;
  - captions and alt text;
  - variant URLs that exist.

  `e2e/links.ts` (`pnpm --filter @0xdolan/deq-site links`, in CI and `just site`) checks every internal link and fragment in `dist`. `--external` lists external URLs for a manual check. Playwright covers the pages, the lightbox, the facade and the citation links. Lighthouse covers a chapter and the Sorani sources page.

- **Turbo inputs.** `apps/site/turbo.json` declares `DEQ_REQUIRE_FONTS` and `DEQ_REQUIRE_MEDIA`, and lists `content/`, the manifest, the videos, the variants, `fonts/dist` and `spec/` as build inputs. Under strict env mode, the fonts flag had not been reaching the build.

## Consequences

- A new image needs a manifest record (`usedIn`), a caption and alt text in three locales, and a `<Figure>` in that chapter in every locale.
- A new claim needs a source in `sources.json`. Adding a source anywhere but the end renumbers later citations, which is acceptable because numbers are generated.
- The ckb and kmr chapters and captions are AI drafts awaiting native review, like the rest of the translations.
- The showcase (Phase 10b) builds on the same media pipeline.
