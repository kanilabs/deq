# 11. Python and Rust ports and the CLIs

- Status: accepted
- Date: 2026-11-16

## Context

Phase 6 ships the renderer in Python and Rust and a `deq` command-line tool in all three languages (PRD §8.9). The ports must produce the same output as `@0xdolan/deq-core`, and the three CLIs must look and behave the same: help, messages, exit codes and files. The Node exporters write 23 formats, several through large JavaScript or WASM libraries (ag-psd, jSquash, resvg-js) with no equal in Python or Rust.

## Decision

### Ports

- **Same data, same output.** `pnpm --filter @0xdolan/deq-core generate` writes `shapes.json` into both ports (`deq_shapes/data/`, `rust/deq-shapes/data/`), so no port reads `spec/` at run time. Each port re-implements expansion, option validation, SVG writing, `compose` and `renderFlag`, and must match every golden fixture in `spec/fixtures/` byte for byte (ADR 0008). The parity tests (`test_parity.py`, `rust/deq-shapes/tests/parity.rs`) run in CI on Linux, macOS and Windows.
- **Number formatting** follows JavaScript: shortest round trip, `toFixed` and round-half-even where core uses them, `String(n)` in messages. Error codes and messages match core's `DeqError`.
- **Names.** PyPI `deq-shapes` (import `deq_shapes`, script `deq`); crates `deq-shapes` and `deq-cli` (binary `deq`). The Rust crates forbid `unsafe`, deny `unwrap`/`expect`/`panic` and keep MSRV 1.85.

### Formats in the ports

- **A core subset:** `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp` and `ico` (the owner's choice). `flag` writes `svg`, `png`, `jpg` and `webp`.
- **Other formats exit with code 4** and `deq: error: format "X" is only available in the Node CLI (npx @0xdolan/deq-cli)`.
- **SVG and PDF are byte for byte** the Node output: the PDF writer of ADR 0009 is ported line for line (same objects, offsets and Optional Content Groups).
- **Rasters are not byte for byte.** Each port uses its own renderer (resvg-js, resvg-py, resvg in Rust) and encoder, so tests check PNG dimensions, JPG and WebP signatures and ICO entry sizes instead of bytes.
- **WebP in Rust is lossless.** The pure-Rust `image-webp` encoder has no lossy mode, so `--quality` only affects JPG in the Rust CLI. Node and Python write lossy WebP.
- **Licences.** `jpeg-encoder` is `(MIT OR Apache-2.0) AND IJG`; the IJG licence is permissive and GPL-compatible, so `deny.toml` allows it for that crate only.

### One CLI interface

- **`spec/cli.json` is the single source** of commands, flags, value types, exit codes and formats. `pnpm --filter @0xdolan/deq-cli generate` turns it into help texts and bash, zsh, fish and PowerShell completions, written into each CLI's data file (`packages/cli/src/generated/`, `deq_shapes/data/cli.json`, `rust/deq-cli/data/cli.json`). A test fails when one is stale.
- **Commands:** `list`, `info`, `render`, `export`, `flag`, `validate` and `completion`. Hand-written parsers in each language follow the same rules (`--` ends options, `-` is an argument, repeated flags are errors, pairs are `name=value`), so messages match exactly; no argument-parsing library is used.
- **Exit codes:** 0 success, 1 invalid shape, option or spec, 2 bad command line (with `Run "deq <command> --help" for usage.`), 3 file errors, 4 Node-only format.
- **Safe writing.** All targets are checked before anything is written; existing files need `--force`, and even then only regular files are replaced (never a directory or symlink). `validate` refuses symlinks, non-regular files and files over 256 KB. File errors are reported by errno name (`ENOENT`, `EACCES` and so on).
- **Shared CLI cases.** `spec/fixtures/cli-cases.json` lists 84 command lines with setup files. `pnpm --filter @0xdolan/deq-cli fixtures` runs them against the Node CLI and records stdout, stderr, exit codes and output files in `spec/fixtures/cli/`. The Python (`test_cli_cases.py`) and Rust (`rust/deq-cli/tests/cases.rs`) tests run every case and compare; `nodeOnly` cases expect exit code 4 from the ports. A case may skip the stderr comparison when the message comes from a port's own library (for example JSON parse errors).
- **Pattern generator and leet** move to Phase 9 (owner's choice), so the CLIs have no `generate` command yet.

## Consequences

- A change to rendering or to the CLI interface must land in three languages, with regenerated fixtures; the parity and CLI case tests catch any drift on all three operating systems.
- Users who need AI, EPS, PSD, AVIF, favicons, components or Figma output use the Node CLI; the error message tells them how.
- Rust WebP files are larger than Node and Python ones at the same settings.
