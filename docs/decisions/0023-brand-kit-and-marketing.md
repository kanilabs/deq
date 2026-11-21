# 23. Brand kit and marketing assets

- Status: accepted
- Date: 2026-11-21

## Context

Phase 12 turns the Dot rosette logo (ADR 0013) into a full brand: a wordmark, lockups, a brand guide, colour tokens, a downloadable kit, social and store images, an animated logo, README clips and a press kit. The logo is already generated from the shape spec. Hand-made marketing files would drift from it, need a font installed to render, and depend on a desktop tool (Inkscape rendered the PNGs until now).

## Decision

- **Wordmark as outlines from the site's fonts.** `uv run deq-fonts wordmark` (`scripts/deq-fonts/src/deq_fonts/wordmark.py`) shapes "Deq" in Noto Sans Bold, "دەق" in Vazirmatn Bold and the English brand lines with HarfBuzz (`uharfbuzz`), and writes the glyph outlines to `assets/brand/wordmark.json`. Both fonts are SIL OFL 1.1 and already ship with the site, so no SVG needs a font and every renderer draws the same shapes.
- **Lockups and images from one generator.** `uv run deq-spec brand` (`brand.py` and `lockups.py`) draws from the rosette and the wordmark: horizontal and stacked lockups in Latin and Sorani (the mark on the right for right-to-left reading) in five colourways (`color`, `reversed`, `mono`, `white`, `flag`), the construction and clear-space drawings, the README banners, the social preview, the Figma cover and the animated logo. Proportions are fractions of the mark's diameter D (Latin cap height 0.5 D, Sorani height 0.75 D, gap 0.25 D, stacked gap 0.2 D, clear space 0.25 D), with minimum sizes of 16 px (mark), 120 px (horizontal) and 64 px (stacked). They, and every colour in HEX, RGB, HSL, OKLCH and CMYK with its contrast, go to `brand.json`, `tokens.css` and `docs/design/brand-colors.md`. `deq-spec lint` fails when any file is stale. `just brand` runs both commands.
- **CMYK is a plain conversion.** It has no colour profile and the guide says so; Pantone values stay out until they are verified from a primary source.
- **Animation.** The dots appear clockwise from the top, then the sun ring draws, in 1.7 s, with CSS in the SVG; `prefers-reduced-motion` shows the still logo. `just brand-video` plays the SVG frame by frame in Playwright's Chromium (animations paused and seeked, so every frame is exact) and encodes `apps/site/public/brand/logo-animated.{mp4,webm}` with ffmpeg.
- **Rasters and kits are built with the site.** `apps/site/src/lib/brandkit.ts` reads `assets/brand/` at build time and serves `/brand/<name>.png` (the exporters' resvg, like the app icons), `/brand/svg/<path>.svg`, `/favicon.ico` (16, 32 and 48 px, `packIco`), `/brand/deq-brand-kit.zip` and `/brand/deq-press-kit.zip`. The ZIPs use the Studio's `zip` with a fixed date and the new `folders` option, which still refuses absolute paths, `..`, empty segments and backslashes. The press kit's fact sheet takes its counts (shapes, formats, languages) from the packages. Inkscape is no longer needed for the brand.
- **Recorded files are committed.** Store screenshots (`just store`: home, icons, Studio and Leet on a phone and a desktop, light and dark, WebP in `public/store/`, the light ones in the web app manifest), the README clips (`just clips`: Studio, Leet and patterns as WebM and a palette GIF in `public/clips/`) and the logo videos come from a browser and ffmpeg, which CI does not run. A missing file fails the build with the recipe to run.
- **Precache stays small.** Workbox ignores `brand/**`, so the kits, PNGs and videos are fetched only when someone asks for them.
- **Guide in two places.** `/brand` on the site (all three locales) and `docs/design/brand.md` in the repo say the same, with the logo, lockups, construction, minimum sizes, colours, typography, iconography, voice and tone, and do's and don'ts.
- **READMEs.** The repo README shows the light or dark SVG banner and the three feature GIFs. Package READMEs use the absolute `https://kanilabs.github.io/deq/brand/banner.png`, because npm, PyPI and crates.io do not resolve repo-relative images.
- **Licence wording.** The kit says the files are GPL-3.0-or-later and the wordmark outlines come from OFL fonts. Keeping the logo unchanged and not implying endorsement is stated as a request, not a licence term.

## Consequences

- A change to the rosette, a font version or a colour flows into every lockup, PNG and kit on the next `just brand` and site build, and lint catches a forgotten regeneration.
- Store screenshots, clips and videos go stale when the UI changes; they must be re-recorded with `just store`, `just clips` and `just brand-video` and checked by eye before committing.
- The package READMEs show the banner only once the site is deployed.
- The GitHub social preview is still uploaded by hand (Settings → Social preview), now from `/brand/social-preview.png`.
- The ckb and kmr strings on `/brand` are drafts awaiting native review.
