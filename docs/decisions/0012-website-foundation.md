# 12. Website foundation

- Status: accepted
- Date: 2026-11-17
- Amended by: [ADR 0013](0013-logo-dot-rosette.md) (the logo is now the Dot rosette, not the chin mark)

## Context

Phase 7 builds the site at `https://kanilabs.github.io/deq/` (PRD §8.11, §9, §10): themes, three languages (one right-to-left), the icon gallery with a page per shape, the flag, fonts, brand and about pages, SEO, a strict CSP, offline support and deployment. GitHub Pages serves static files only and cannot set response headers. The definition of done asks for Lighthouse ≥ 95, at most 50 KB of gzipped JavaScript on pages other than Studio, no serious axe issues, correct RTL and offline use.

## Decision

### Stack

- **Astro 7 + Starlight** in `apps/site` (private package `@0xdolan/deq-site`). Starlight gives the layout, search (Pagefind), the theme switcher, sidebar, hreflang alternates and the sitemap. Our own pages (`src/pages/[...locale]/`) render through `StarlightPage`, so the whole site has one layout. Starlight's `Head`, `Banner` and `Footer` are overridden; nothing else is.
- **No UI framework islands yet.** Every page is static HTML with small bundled scripts (the icon filter, the font weight slider, the update prompt). Studio (Phase 8) adds islands.
- **Data comes from the source of truth**: `spec/catalog.json`, `spec/flag.json`, `fonts/codepoints.json` and `@0xdolan/deq-core`'s `render`. Nothing is copied by hand.

### Themes (Q9)

- Light, dark and system, using Starlight's switcher and its inline theme script (no flash of the wrong theme). The choice is stored in `localStorage` (`starlight-theme`). A true-black theme is left for later.
- Accent colours come from the flag green, darkened or lightened for text contrast. The pairs used for text are dark mode `#8fdba5` on the page (10.85:1), and light mode `#1d6b33` on white and white on `#1d6b33` (6.56:1 each). Flag colours are only used as fills, never as text (deq-brand skill).
- UI fonts are self-hosted through Fontsource: Noto Sans for Latin and Vazirmatn for Arabic script, both variable and split by `unicode-range`. On ckb pages the Arabic subset is preloaded so the font swap does not move the layout.

### Languages (Q10)

- `en` (default, no prefix), `ckb` (`/ckb/`, `dir="rtl"`) and `kmr` (`/kmr/`). The site's strings are TypeScript catalogs in `src/i18n/messages/`: `en.ts` defines `Messages`, and `ckb.ts` and `kmr.ts` must `satisfy` it, so a missing or extra key fails `astro check`. A unit test checks the keys, non-empty values and placeholders again. Starlight's own UI strings for ckb and kmr live in `src/i18n/starlight.ts`.
- The Sorani and Kurmanji text is AI-drafted. Every ckb and kmr page shows a "needs native review" banner, and shape names keep their `needs-native-review` status from the spec. A tracking issue collects the review.
- Layout uses CSS logical properties; the e2e suite checks `lang` and `dir` on every page in all three languages.

### SEO

- Starlight writes the title, description, canonical URL, Open Graph text, hreflang alternates and the sitemap. `Head.astro` adds a share image per page and per icon (`og/**.png`, 1200 × 630, rasterised at build time with `encodeSvg` from `@0xdolan/deq-exporters`), the Twitter image, JSON-LD (`WebSite` or `WebPage`, with `<` escaped), the manifest and theme colours.
- `robots.txt`, `llms.txt` and `llms-full.txt` (every shape with its id, code point and names) are endpoints built from the same data.

### Content Security Policy

- Astro's `security.csp` writes a `<meta>` CSP on every page: `default-src 'self'`, `img-src 'self' data:`, `font-src 'self'`, `frame-src` limited to `www.youtube-nocookie.com` and `kanilabs.github.io`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and SHA-256 hashes for the scripts and styles Astro bundles.
- **Inline scripts from Starlight.** Astro does not hash `is:inline` scripts, and Starlight uses three (the theme provider, the search dialog opener, the theme picker update). `integrations/csp.ts` adds the hash of every inline executable script to its page's `script-src` after the build. Only build output is hashed; visitor data never reaches an inline script. `'unsafe-inline'` is never allowed for scripts.
- **Style attributes.** Starlight and Expressive Code set CSS custom properties in `style` attributes (sidebar depth, icon sizes, code token colours), which hashes cannot cover. The policy allows `'unsafe-inline'` in `style-src-attr` only; `<style>` elements stay hash-checked. Injected style attributes cannot run code, and nothing on the site puts visitor input into markup.
- **Trusted Types are deferred.** `require-trusted-types-for 'script'` breaks Pagefind's search UI, Starlight's DOM updates and the service worker registration. The only workaround is a pass-through default policy, which adds no protection. Revisit when these libraries support Trusted Types.

### Offline (PWA)

- A web app manifest (`manifest.webmanifest`, icons rendered from the chin mark, shortcuts to Icons and Docs) and a Workbox service worker.
- **Workbox `generateSW` in our own integration** (`integrations/pwa.ts`), not `@vite-pwa/astro`. The integration runs after Astro writes the site, so the precache holds the final HTML (after the CSP hashes) and every page in every language. `@vite-pwa/astro` would add a dependency layer for no gain on a static site.
- Everything except share images and the search index is precached (about 440 files, 12 MB). The search index is cached as it is used (stale-while-revalidate). New versions wait (`skipWaiting: false`) until the visitor accepts the update prompt (`PwaUpdate.astro`, `workbox-window`).
- `workbox-build` depends on glob 11, which finds no files with the repository's `minimatch` 11.0.3 override. A scoped override (`workbox-build>glob: 14.0.4`) fixes this; remove it when `workbox-build` depends on glob 14 or later.

### Analytics (Q8)

- None. No analytics, tracking or third-party requests.

### Checks

- Unit tests (Vitest) cover the i18n catalogs and helpers, share-image paths, the data helpers, `llms.txt`, the CSP step and the mark's match with logo concept A.
- Playwright (`e2e/site.spec.ts`) against the built site: `lang` and `dir`, no CSP violations, no serious or critical axe issues and the JavaScript budget, on eight pages in each of the three languages. It also checks the dark theme and that it persists, the icon filter, search, the 404 page, the SEO files, and offline use through the service worker.
- Lighthouse (`e2e/lighthouse.ts`, Playwright's Chromium): performance, accessibility, best practices and SEO must each score ≥ 95 on eight pages. Measured: 96 to 100.
- The `site` CI job builds the icon fonts, builds the site with `DEQ_REQUIRE_FONTS=1` and runs both suites. Locally: `just site`.

### Deployment

- `.github/workflows/pages.yml` builds the fonts and the site and deploys with `actions/deploy-pages`. GitHub Pages serves one site per repository, so pushes to `develop` deploy a preview while the repository variable `PAGES_PRODUCTION` is not `true`, and a published release always deploys production. After the first release, set `PAGES_PRODUCTION=true` so `develop` no longer overwrites production.
- The repository's Pages source must be set to "GitHub Actions".

## Consequences

- Upgrading Starlight can change its inline scripts or style attributes. The CSP step adapts to new scripts, and the e2e suite fails on any CSP violation.
- The precache grows with every page. 12 MB is acceptable for an icon site that promises offline use; Phase 8 should check the size again when Studio arrives.
- Translations stay marked as drafts until native speakers review them.
