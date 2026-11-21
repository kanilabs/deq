---
title: Testing
description: The test suites for TypeScript, Python, Rust and the website, the coverage gates and how to run each one.
sidebar:
  order: 10
---

`just ci` runs everything the main CI workflow runs: forbidden files, lint, type checks, tests, build, dependency audits and the secret scan. The commands below run one part at a time.

## Unit tests

| Language   | Command                           | Tool               | Gate                                                                  |
| ---------- | --------------------------------- | ------------------ | --------------------------------------------------------------------- |
| TypeScript | `pnpm test` (Turborepo)           | Vitest             | 95% lines, functions and statements, 90% branches                     |
| Python     | `uv run pytest`                   | pytest, pytest-cov | 95% coverage over `deq_shapes`, `deq_spec`, `deq_assets`, `deq_fonts` |
| Rust       | `cargo test --workspace --locked` | cargo test         | every test passes                                                     |
| Spec       | `uv run deq-spec lint`            | deq-spec           | no errors                                                             |
| Assets     | `uv run deq-assets verify`        | deq-assets         | every image matches the manifest                                      |

`just test` runs all five. One package: `pnpm --filter @0xdolan/deq-core test`. Vitest resolves the other packages from their `dist/` folders, so build a package after changing it (`turbo test` does this for you).

The `test` CI job runs the unit tests on Linux, macOS and Windows.

## Golden fixtures and parity

Core writes the expected output to `spec/fixtures/`, and every renderer must match it byte for byte ([ADR 0008](../decisions/0008-core-renderer-and-golden-fixtures.md)):

- core's tests fail when a fixture is stale;
- Python (`test_parity.py`) and Rust (`rust/deq-shapes/tests/parity.rs`) render every fixture case and compare;
- the Leet and pattern fixtures in `spec/fixtures/leet/` are checked the same way;
- the CLI cases in `spec/fixtures/cli-cases.json` are recorded from the Node CLI into `spec/fixtures/cli/` and replayed by the Python and Rust CLIs on all three operating systems.

A new behaviour gets a fixture or a CLI case, not only a unit test.

## Generated files

Every generated file has a test or lint check that regenerates it in memory and compares it with the committed file. When one fails, run the command named in the message; the [codegen pipeline](codegen.md) lists them all.

## Tests that need outside tools

| Command            | Needs                      | What it checks                                                       |
| ------------------ | -------------------------- | -------------------------------------------------------------------- |
| `just test-tools`  | Inkscape 1.4+, Ghostscript | PDF, EPS and AI files render correctly and keep their layers         |
| `just fonts-check` | the `fonts` uv group       | fontbakery with ots on every font, and an install through fontconfig |

Without the tools these tests are skipped. The `exporter-tools` and `fonts` CI jobs install the tools and fail instead of skipping.

## Website

```sh
just site
```

This builds the site with the fonts and story images, checks every internal link, runs Playwright with axe on desktop Chromium (and the Studio and Leet tests on a Pixel 7 profile too), checks that the site works offline, and runs Lighthouse, which must score at least 95 in every category. The e2e suite also fails on any CSP violation.

The site's unit tests (`apps/site/test/`) run with `pnpm test` like any other package. They cover the Studio modules, imports and exports, the docs links, the story data and the i18n catalogs.

## Before a pull request

1. `just fmt`
2. `just ci`
3. `just site` when the website changed, and `just test-tools` when an exporter changed.
