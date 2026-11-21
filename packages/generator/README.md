# @0xdolan/deq-generator

<img src="https://kanilabs.github.io/deq/brand/banner.png" width="640" height="160" alt="Deq · دەق: the Dot rosette logo, traditional Kurdish tattoo shapes as an open, parametric design system.">

Deq Leet writes text as deq motifs, and the pattern generator builds seeded bands, grids, rosettes and borders. The output is SVG with one layer per character or motif, and the Python and Rust ports match it byte for byte ([ADR 0015](../../docs/decisions/0015-deq-leet-and-pattern-generator.md)).

```ts
import { decodeLeet, leet, pattern } from "@0xdolan/deq-generator";

const { svg, text, unknown } = leet("Deq: Kurdistan 2026", { level: "advanced", seed: 42 });
leet("دەق", { align: "center" }); // Sorani, right to left (detected)
decodeLeet(leet("Roj baş").svg).text; // "ROJ BAŞ"
pattern({ kind: "rosette", petals: 12, seed: 7, colors: ["#ED2024", "#278E43"] }).svg;
```

## Leet

`leet(text, options)` returns `{ svg, text, script, level, unknown, scene }`.

| Option          | Default  | Meaning                                                                                           |
| --------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `level`         | `basic`  | `basic` (readable, decodable), `advanced` (seeded alternatives), `full` (one motif per character) |
| `script`        | detected | `latin` (Latin, Kurmanji, digits, punctuation) or `sorani` (RTL)                                  |
| `seed`          | 1        | Unsigned 32-bit seed for `advanced`                                                               |
| `letterSpacing` | 2        | Grid units between glyphs (0..24)                                                                 |
| `lineSpacing`   | 6        | Grid units between lines (0..48)                                                                  |
| `align`         | `start`  | `start`, `center` or `end` in reading direction                                                   |
| `colors`        |          | 1–16 CSS colours, used in turn per glyph                                                          |

Every core render option applies as well, except `rotation`, `flipX`, `flipY`, `params` and `layerColors`. Input is plain text, capped at 1,024 characters, 256 glyphs and 32 lines. It is normalised (NFC, case, aliases such as Persian digits), and characters outside the table are dropped and listed in `unknown`.

`decodeLeet(svg, renderOptions)` reads basic output back to `{ text, script, unmatched }`. Pass the render options used to make the SVG. Glyphs it cannot match read as U+FFFD.

The tables live in `spec/leet/` and are drawn in [`docs/design/leet-chart.svg`](../../docs/design/leet-chart.svg).

## Patterns

`pattern(options)` returns `{ svg, motifs, scene }`. Options: `kind` (`band`, `grid`, `rosette`, `border`), `seed`, `motifs` (shape ids; default the whole catalog), `count` (odd, 3..63, band), `cols` and `rows` (grid, border), `petals` (3..24, rosette), `spacing` (0..24) and the scene render options.

## Development

- `pnpm generate` copies `spec/leet/` into `src/generated/leet.ts`.
- `pnpm fixtures` writes `spec/fixtures/leet/` and the chart from `dist/`; tests fail when either is stale.

License: GPL-3.0-or-later.
