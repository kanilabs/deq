# 16. The Deq Leet font

- Status: accepted
- Date: 2026-11-18

## Context

Phase 9c adds a font that shows Deq Leet glyphs (ADR 0015) for normal Latin, Kurmanji and Sorani text, so people can write Leet in any app without the generator. Text copied from a Leet scene as Private Use Area (PUA) characters must keep its exact glyphs, including the advanced alternatives and the full motifs. The font has to pass fontbakery, like the icon fonts (ADR 0010).

## Decision

- **Same geometry as the generator.** `pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json` writes every glyph (basic, advanced alternatives and full, per script) as `expandGlyph` flat data. `scripts/deq-fonts/src/deq_fonts/leet.py` turns it into outlines with the icon font builder (UPM 960, 40 font units per canvas unit, stroke width 2, overlaps removed). Families: `Deq Leet`, files `DeqLeet-Regular.{otf,ttf,woff2}` and `deq-leet.css` (the font face and a `.deq-leet` class).
- **Monospaced cells.** Every glyph, including space, no-break space and `.notdef`, is 26 units wide: the 24-unit cell plus the generator's default letter spacing (2), with the glyph centred. `post.isFixedPitch` is set and panose says monospaced. The generator's default line spacing (6 units) is split above and below the line (ascent 880, descent 320, line gap 0), so the line height matches a default scene.
- **The character map does the basic level.** Each table character, its lower case and its aliases map straight to the basic glyph, so the font works even where no shaping happens. Characters both tables share (punctuation such as `!`) map to the Latin glyph (`uniXXXX`); the Sorani glyph is `uniXXXX.ar`. An alias whose code point is already taken (ASCII digits, which are Sorani aliases of the Arabic-Indic digits) keeps the Latin glyph in the cmap.
- **No `ccmp`, no marks.** Shapers compose canonically decomposed input before the cmap lookup (`C` + U+0327 → `Ç`, U+064A + U+0654 → `ئ`), so the font needs no mark glyphs. Tatweel is not mapped: the generator removes it, and a zero-width letter fails fontbakery.
- **GSUB.**
  - `locl` (script `arab`) switches shared characters and the ASCII digits to the Sorani glyphs in Arabic-script runs.
  - `ss01` and `ss02` ("Advanced alternative 1/2") select the first and second advanced alternatives. `ss03` ("Full level") selects the full motif. `salt` offers every alternative followed by the full motif.
  - The seeded advanced level of the generator cannot be expressed in OpenType. PUA code points are the exact way to get it.
- **PUA code points U+F000–U+F8FF.** `uv run deq-fonts codepoints` assigns them in `fonts/leet-codepoints.json`, nested as `{script: {char: {basic, advanced: [...], full}}}`, in table order (basic, then advanced, then full). Existing values are kept, also for removed characters, and never reused. The table is in `docs/fonts/leet-codepoints.md`. Built fonts ship `leet-codepoints.json` with the current characters only. The icon fonts are capped at U+E000–U+EFFF, so the two ranges never meet.
- **Build and CI.** `just fonts`, the `fonts` and `site` CI jobs and the Pages workflow build the generator and write `leet.json` before `deq-fonts codepoints --check` and `deq-fonts build`. `deq-fonts install-check` expects the `Deq Leet` family.
- **fontbakery.** No FAIL on either file. Accepted WARNs: UPM 960 is not a power of two (as ADR 0010), `numberOfHMetrics` is 1 rather than 3 (fontTools packs equal advances, which is valid for a monospaced font), contour counts that differ from Latin letter expectations (the glyphs are motifs, not letters), and overlapping segments in the TTF. fontbakery 1.1.0's `opentype/monospace` check crashes on CFF fonts (`KeyError: 'glyf'`), so CI skips that check (`-x opentype/monospace`) for `DeqLeet-Regular.otf` only; the TTF runs it.

## Consequences

- A new or changed table character needs `pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json`, then `uv run deq-fonts codepoints`, and the updated `fonts/leet-codepoints.json` and `docs/fonts/leet-codepoints.md` committed.
- Glyphs drawn at the font's fixed stroke width match the generator's default render options only. Other options are for SVG scenes.
- The site `/leet` page, the Studio tabs and "copy as PUA text" ship in 9d and use this font.
- Remove the OTF exclusion when a fontbakery release fixes the monospace check for CFF fonts.
