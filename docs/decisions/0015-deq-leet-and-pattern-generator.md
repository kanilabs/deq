# 15. Deq Leet and the pattern generator

- Status: accepted
- Date: 2026-11-18

## Context

Phase 9 adds Deq Leet, which writes text as deq motifs, and a generator for seeded patterns: bands, grids, rosettes and borders. Both need the same output in TypeScript, Python and Rust (ADR 0008, ADR 0011). Leet has to handle Latin and Kurmanji letters, Sorani in Arabic script written right to left, and digits. Its output must be readable at the basic level and decodable back to text. The work ships as four pull requests: 9a covers the spec, lint and TypeScript generator; 9b the Python and Rust ports and `deq leet` / `deq generate` in the three CLIs; 9c the Leet font; 9d the site page, the Studio tabs and export of wide scenes.

## Decision

- **Tables are spec data.** `spec/leet/latin.json` and `spec/leet/sorani.json` follow `spec/schema/leet.schema.json`. Each glyph is a character with a `fit` (`good`, `fair`, `rough`, or `count` for digits), a `basic` glyph, up to several `advanced` alternatives and one `full` motif. A glyph is a list of catalog shapes with optional params, rotate, scale and translate. `aliases` map look-alike input (dashes, Persian digits, Arabic kaf and yeh) to table characters. The owner approved the drafted map. Digits 1–9 are dot counts and 0 is a small ring; look-alike shapes are their advanced alternatives.
- **The lint guards readability.** `uv run deq-spec lint` checks the schema, the script and direction, upper-case and unique characters, that every shape and parameter exists, that ink stays inside 0..24, that the basic glyphs are unique (so decoding is unambiguous), the aliases, and the canonical format. `deq-spec fmt` formats the tables.
- **Input is plain text.** Leet normalises to NFC and LF, removes zero-width characters, bidi controls, BOM and tatweel, then upper-cases and applies the aliases. Unknown characters are dropped and reported. Input is capped at 1,024 characters, 256 glyphs and 32 lines. Text is never parsed as markup: it only reaches the SVG `<title>`, escaped.
- **Layout.** Each glyph fills a 24-unit cell. The advance is 24 + `letterSpacing` (default 2) and the line height is 24 + `lineSpacing` (default 6). Sorani lines run right to left; `align` is `start`, `center` or `end` in reading direction.
- **One layer per character.** A scene is cells at x/y offsets. `sceneSvg` writes core's root (`svgRoot`, which now takes a width and height) and one `<g data-layer="cN" transform="translate(x y)">` per cell, so the exporters can keep one layer per character. Leet adds `data-deq-leet="<script> <level> <advance-x> <advance-y>"` to the root. `colors` (1–16) colour the cells in turn. Rotation, flips, params and layer colours are not available for scenes. A scene is capped at 20,000 elements.
- **Seeded randomness.** mulberry32 on unsigned 32-bit integers (seed 0..2³²−1, default 1). `below(n)` is `next() % n`. The ports must draw the same numbers. The advanced level picks each glyph from the basic one and its alternatives; the basic and full levels use no randomness.
- **Decoding.** `decodeLeet(svg, renderOptions)` reads the root metadata, renders the basic glyphs with the same render options and compares each cell's markup. Spaces and newlines come from the gaps between cells. Cells that match nothing read as U+FFFD and are counted. Input is capped at 4 MiB. Decoding the basic level always gives back the normalised text.
- **Patterns.** `pattern({ kind, seed, motifs, count, cols, rows, petals, spacing })`. A band is an odd row that is either mirrored or alternates two motifs. A grid alternates motifs in a checkerboard. A rosette puts a centre motif in a ring of rotated petals at three-quarter scale. A border has rotated corner and edge motifs around an empty middle. Motifs default to the whole catalog.
- **Golden fixtures.** `spec/fixtures/leet/` holds 28 cases (every character at every level, layouts, render options, colours, edge seeds and every pattern kind) written by `pnpm --filter @0xdolan/deq-generator fixtures`, together with the chart `docs/design/leet-chart.svg`. Every port must write every file byte for byte and decode every `decoded` case.
- **Trigonometry parity (9b).** Rotated glyphs and rosette petals need sines and cosines that match V8 to the last bit, so the Python (`_trig.py`) and Rust (`trig.rs`) ports carry a port of fdlibm `sin`/`cos` instead of the platform functions.
- **CLI (9b).** `deq leet [text]` writes `leet.<format>` and `deq leet --decode <file>` prints the text; `deq generate` writes `pattern-<kind>-<seed>.<format>`. Scenes export as `svg`, `png`, `jpg` or `webp` in all three CLIs. `--size` is the pixel size of one 24-unit cell, and rasters are capped at 8192 × 8192 px. `spec/cli.json` gains `omit`, which drops single flags from a shared set (rotation, flips, params and layer colours). Decoding reads at most 4 MiB, refuses symlinks and non-regular files, refuses the output flags, and warns about unread glyphs and dropped characters on stderr.

## Consequences

- A new table character needs a unique basic glyph, a lint pass, and fresh fixtures and chart. It also needs code points from `uv run deq-fonts codepoints` for the Leet font (ADR 0016).
- Decoding needs the render options used for the output. Other options read as U+FFFD instead of guessing.
- The Leet font (9c, ADR 0016) gives every glyph a PUA code point. Copy as PUA text ships with the site page in 9d.
- The site's Leet and pattern pages, the Studio tabs and scene export are in ADR 0017 (9d). Frames and the PUA text are site features; the generator, ports and fixtures are unchanged.
