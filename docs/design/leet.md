# Deq Leet tables

Deq Leet writes text as deq motifs. The tables in `spec/leet/` are the source; the decision is [ADR 0015](../decisions/0015-deq-leet-and-pattern-generator.md) and the chart is [`leet-chart.svg`](leet-chart.svg).

## A table entry

```json
{
  "char": "C",
  "fit": "good",
  "basic": [{ "shape": "heyv-crescent", "transform": { "rotate": 180 } }],
  "advanced": [[{ "shape": "arch-dot", "transform": { "rotate": -90 } }]],
  "full": [{ "shape": "chevron-stack" }]
}
```

- `char`: one upper-case character (Sorani letters as they are).
- `fit`: how well the basic glyph reads: `good`, `fair`, `rough`, or `count` for digits drawn as dot counts.
- `basic`: the readable glyph. It must differ from every other basic glyph in the table, because decoding compares them.
- `advanced`: alternatives the `advanced` level picks from by seed, together with `basic`.
- `full`: one motif, decorative rather than readable.
- A glyph is a list of parts: a catalog `shape`, optional `params` and an optional `transform` with `rotate`, `scale` and `translate` in grid units. Ink must stay inside the 24-unit canvas.
- `aliases` at the top map look-alike input to table characters, such as `—` to `-` or `۲` to `٢`.

## On the site

The `/leet` and `/generate` pages and the Studio tabs are described in [ADR 0017](../decisions/0017-leet-and-patterns-on-the-site.md), and for users in the guides [Deq Leet](../guide/leet.md) and [Patterns](../guide/generate.md). Frames and the font text are site features and never reach the fixtures.

## Changing a table

1. Edit `spec/leet/<script>.json`, then run `uv run deq-spec fmt` and `uv run deq-spec lint`.
2. Run `pnpm --filter @0xdolan/deq-generator generate`, then `fixtures` (this rewrites `spec/fixtures/leet/` and the chart).
3. Check the chart, and render the changed fixtures to PNG to look at them.
4. From 9b on, the Python and Rust ports must pass the new fixtures too.
