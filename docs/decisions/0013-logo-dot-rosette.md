# 13. Logo: the Dot rosette

- Status: accepted
- Date: 2026-11-17
- Supersedes: the chin mark (logo concept A) chosen in Phase 2, and the logo parts of [ADR 0012](0012-website-foundation.md)

## Context

Phase 2 chose concept A, the chin mark, as the working logo. The owner then asked for the Dot rosette (`spec/shapes/dot-rosette.json`) to be the Deq icon everywhere (favicon, site, GitHub Pages, social media, app icons), in the style of the other Kanî Labs projects.

## Decision

- **The mark is the Dot rosette** with its default parameters (`center: "ring"`, 8 dots): a ring of radius 3 and eight dots of radius 1 on a circle of radius 7, on the 24-unit grid.
- **Kanî Labs style.** The full logo (`assets/brand/logo.svg`) is the Kanî badge: a 1024 canvas with a `#F8F8F8` disc of radius 490 and a 4 px `#1E1E1E` outline, holding the rosette at 38 px per grid unit. Dots are Kanî ink green `#1D4A2E`, the ring is the sun yellow `#FEBD11`. In dark mode the dots use the site's dark accent `#8FDBA5`.
- **Optical small sizes.** At 64 px and below, dots of radius 1 and a 2-unit ring fade, so `mark-small*.svg` and `favicon.svg` use dots of radius 1.5 and a ring stroke of 2.4, cropped to `viewBox="3 3 18 18"`. `mark.svg`, `mark-dark.svg` and `mark-mono.svg` keep the exact spec weights.
- **Generated, never hand-edited.** `uv run deq-spec brand` (`scripts/deq-spec/src/deq_spec/brand.py`) writes every file in `assets/brand/` from the shape's geometry; `deq-spec lint` fails when one is stale, and the generator refuses to write through a symlink. The PNGs (social preview, avatars, lockups) are rendered by the site build at `/brand/<name>.png`; until Phase 12, `just brand` rendered them with Inkscape ([ADR 0023](0023-brand-kit-and-marketing.md)).
- **The site uses these files** for the header logo, the favicon (served from `src/pages/favicon.svg.ts`), the app icons, the corner mark of the share cards and the Brand page. The old `public/favicon.svg` and `src/assets/mark-*.svg` are removed.
- **Contrast.** The yellow ring on the light disc is decorative, like the flag's sun; the mark carries no text, so WCAG text contrast does not apply. Text on brand surfaces still follows the colour rules in the `deq-brand` skill.
- Still no wordmark or lockup; Phase 12 adds them.

## Consequences

- One source: changing the shape spec changes the logo, and lint keeps them in step.
- The GitHub social preview is uploaded by hand (Settings → Social preview) from `/brand/social-preview.png` on the site.
- Logo concepts A to D stay in `assets/brand/concepts/` for reference.
