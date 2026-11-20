---
name: deq-content
description: Rules for writing Deq story, history, shape meanings and sources, and for using images and videos. Use when editing content/, the story, or the sources page.
---

# Deq content

> Updated in Phase 10b (showcase).

- Every factual sentence cites a source in `content/sources.json` (CSL-JSON). Where sources disagree, say so. Never invent facts.
- Every image has a caption, credit, source URL, and alt text in en, ckb and kmr; record it in `assets/source-manifest.json`. Strip EXIF/GPS metadata.
- Use every processed image in the story. Rename to ASCII kebab-case.
- YouTube: embed via `youtube-nocookie.com` behind a click-to-load facade. Link Instagram; do not embed it.
- The credits page includes a "rights holders: contact us for corrections or removal" note.

## Sources (`content/sources.json`)

- CSL-JSON array. `id` is kebab-case (`<publisher>-<year>`, `yt-<slug>`, `instagram-<handle>`). Set `accessed` to the date you read the page.
- `custom.group`: `articles`, `academic`, `photo-essays`, `video`, `social` or `archives` (the groups on the `/sources` page).
- `custom.status`: `ok`, `archived` (read from Wayback, so set `custom.archiveUrl`), `partial` (metadata only), `blocked` (refused automated access; do not retry or work around it) or `to-verify` (a cited work not yet checked).
- Fetch with an honest user agent (`deq-research/0.1 (+https://github.com/kanilabs/deq)`). Never spoof a browser.
- Research notes live in `docs/research/notes.md`, one cited fact per bullet, with disagreements listed rather than merged.

## Images (`assets/`)

- Originals stay in `temp/images/` (never committed). Process with `uv run deq-assets process`. This writes metadata-free WebP masters (max 2400 px) to `assets/images/<category>/` and animated WebP to `assets/video/`.
- Categories: `story/{historical,ethnographic,contemporary,artists,patterns,documentary}` and `references/shapes`.
- Every file, kept or excluded, has a record in `assets/source-manifest.json`. `uv run deq-assets verify` (in `just test` and CI) checks hashes, metadata, unlisted files and `sourceId`s.
- `attribution`: `confirmed` (found on a cited page that credits it, so a `sourceId` is required), `inferred` (evidence but no match; say what the evidence is in `attributionNote`) or `unknown`. Never upgrade an attribution without new evidence. Never show an inferred credit as confirmed.
- `rights`: `owner-permission` (the owner's statement) or a licence id such as `cc-by-nc-sa-2.0` when the source page states one. Add new licence ids to `RIGHTS` in `scripts/deq-assets/src/deq_assets/manifest.py`, and honour their terms (credit, non-commercial, share-alike) on the site.
- Tag `motifs` with ids from `docs/research/motif-catalog.md`.
- Responsive variants are built with `uv run deq-assets variants` into the gitignored `assets/.generated/`. Never commit them.
- Captions and alt text (en, ckb, kmr) live in `content/story/images.json`. Set `usedIn` in the manifest to the chapter slug that shows the image.

## Story (`content/story/`, ADR 0018)

- Chapters are `content/story/<locale>/NN-<slug>.mdx`, with frontmatter `title` and `description`. Slugs are `CHAPTERS` in `apps/site/src/lib/story.ts`. Every locale has the same chapters.
- Components: `<Cite ids="a b" />` after each cited sentence, `<Figure id="<asset>" />`, `<Gallery>` around several figures, `<YouTube id="<source id>" />` (a `video` source with `custom.youtubeId`) and `<SiteLink to="icons/" />`. Do not add raw HTML or other embeds.
- Every paragraph and list item has a `<Cite>` (or a `<SiteLink>` for a site-only sentence). Translations keep the same figures, galleries, videos, links and citation ids in the same order. `test/story.test.ts` checks all of this.
- Every manifest image appears once per locale, in the chapter named by its `usedIn`.
- Citation numbers come from the order in `sources.json`. Add new sources at the end.
- Run `just media` (variants) before building the site. Check links with `pnpm --filter @0xdolan/deq-site links`, adding `--external` to list external URLs for a manual check.

## Showcase (`content/showcase.json`, ADR 0019)

- Only list a project with its owner's consent (the issue template asks for it). Describe it from its own site or repository. Never invent features.
- `shapes` lists spec ids the project visibly uses. Confirm them with the owner. Do not guess from a logo alone.
- After adding or changing a project, run `pnpm --filter @0xdolan/deq-site shots <id>` and commit both WebP files.
- Live previews stay click-to-load and sandboxed without `allow-same-origin`. Never add it, because the projects share this site's origin.
