# Deq website

The site at https://kanilabs.github.io/deq/: Astro 7 + Starlight, in English, Sorani (`ckb`, right-to-left) and Kurmanji (`kmr`), with light, dark and system themes, a page per icon, a strict CSP and offline support. Decisions: [ADR 0012](../../docs/decisions/0012-website-foundation.md).

## Commands

Run from the repository root unless noted.

| Task                                        | Command                                                |
| ------------------------------------------- | ------------------------------------------------------ |
| Dev server                                  | `pnpm --filter @0xdolan/deq-site dev`                  |
| Build (`apps/site/dist`)                    | `pnpm exec turbo run build --filter=@0xdolan/deq-site` |
| Type check (`astro check`)                  | `pnpm --filter @0xdolan/deq-site typecheck`            |
| Unit tests                                  | `pnpm --filter @0xdolan/deq-site test`                 |
| Fonts + build + Playwright/axe + Lighthouse | `just site`                                            |

The Fonts page shows the icon fonts from `fonts/dist/` (`just fonts`). Without them the build only warns; `DEQ_REQUIRE_FONTS=1` (CI and the Pages workflow) makes it fail.

## Layout

- `src/pages/[...locale]/`: the site's pages in every locale (Home, Icons, `icons/<id>`, Flag, Fonts, Brand, About). `src/pages/404.astro`, and endpoints for `svg/<id>.svg`, share images (`og/`), app icons (`app/`), the manifest, `robots.txt`, `llms.txt` and `llms-full.txt`.
- `src/content/docs/`: the docs pages (Markdown and MDX) per locale.
- `src/i18n/`: typed message catalogs (`messages/en.ts` defines the keys) and Starlight's UI strings for ckb and kmr.
- `src/components/`: Starlight overrides (`Head`, `Banner`, `Footer`) and the icon tiles.
- `integrations/`: build steps that copy the fonts, add CSP hashes for inline scripts, and generate the Workbox service worker, in that order.
- `e2e/`: Playwright tests and the Lighthouse gate. `test/`: Vitest unit tests.

## Translations

Add every new string to `src/i18n/messages/en.ts` first; `ckb.ts` and `kmr.ts` then fail to type-check until they have it. The Sorani and Kurmanji text is AI-drafted and needs native review (see the `deq-i18n` skill).
