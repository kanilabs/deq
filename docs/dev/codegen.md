---
title: Codegen pipeline
description: Which files are generated, from what, by which command, and which check fails when one is stale.
sidebar:
  order: 5
---

Generated files are committed so that packages build without running the generators, and so that a review shows what a change does to the output. Each one has a "generated, do not edit" header and a check that fails when it is out of date. Never edit them by hand: change the source and run the command.

Run the steps in this order after a change to `spec/`, because each one reads the output of the one before.

| Source                                      | Command                                                  | Writes                                                                                         | Checked by                            |
| ------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| `spec/shapes/*.json`                        | `uv run deq-spec fmt`                                    | `metrics` in each shape file, canonical JSON layout                                            | `deq-spec lint`                       |
| `spec/`                                     | `uv run deq-spec sheet --set shapes --force`             | `docs/design/shapes-contact-sheet.svg` (`--set concepts`: `logo-concepts.svg`)                 | `deq-spec lint`                       |
| `spec/` (Dot rosette)                       | `uv run deq-spec brand`                                  | `assets/brand/*.svg` (`just brand` adds the PNGs)                                              | `deq-spec lint`                       |
| `spec/catalog.json`, `shapes/`, `flag.json` | `pnpm --filter @0xdolan/deq-core generate`               | `packages/core/src/generated/{shapes,flag}.ts`, `shapes.json` for the Python and Rust ports    | core tests                            |
| core (built)                                | `pnpm --filter @0xdolan/deq-core fixtures`               | the golden SVGs in `spec/fixtures/`                                                            | core, Python and Rust tests           |
| core                                        | `pnpm --filter @0xdolan/deq-icons generate`              | `packages/icons/src/generated/`                                                                | icons tests                           |
| icons                                       | `pnpm --filter @0xdolan/deq-{react,vue,svelte} generate` | one component per shape in each package's `src/generated/`                                     | each package's tests                  |
| `spec/leet/*.json`                          | `pnpm --filter @0xdolan/deq-generator generate`          | `packages/generator/src/generated/leet.ts` and `leet.json` for the ports                       | generator tests                       |
| generator (built)                           | `pnpm --filter @0xdolan/deq-generator fixtures`          | `spec/fixtures/leet/` and `docs/design/leet-chart.svg`                                         | generator, Python and Rust tests      |
| `spec/cli.json`                             | `pnpm --filter @0xdolan/deq-cli generate`                | help texts and completions for the three CLIs, and the [command reference](../api/commands.md) | CLI tests                             |
| `spec/fixtures/cli-cases.json`              | `pnpm --filter @0xdolan/deq-cli fixtures`                | the recorded Node results in `spec/fixtures/cli/`                                              | Python and Rust CLI tests             |
| new shapes or Leet glyphs                   | `uv run deq-fonts codepoints`                            | `fonts/codepoints.json`, `fonts/leet-codepoints.json` and their tables in `docs/fonts/`        | `deq-fonts codepoints --check`        |
| TSDoc and docstrings                        | `just api-docs`                                          | the [API references](../api/core.md) in `docs/api/`                                            | each package's tests, `deq-spec lint` |

## Things to know

- Vitest resolves workspace packages from their `dist/` folders. After changing core, build it (`pnpm --filter @0xdolan/deq-core build`) before you run another package's generator or tests. `turbo test` builds dependencies first.
- The core fixtures script builds core itself. A fixture change that is not caused by a shape change is a change to the output format: write an ADR first, as [ADR 0008](../decisions/0008-core-renderer-and-golden-fixtures.md) asks.
- Code points are assigned once and never changed or reused, even when a shape is removed.
- Prettier ignores generated folders (see `.prettierignore`), so their layout comes only from the generator.
