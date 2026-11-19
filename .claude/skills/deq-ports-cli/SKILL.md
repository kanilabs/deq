---
name: deq-ports-cli
description: Rules for the Python and Rust ports (deq-shapes) and the three deq CLIs (Node, Python, Rust) with their shared interface, fixtures and exit codes. Use when changing rendering logic, a port, a CLI command, flag or message.
---

# Deq ports and CLIs

Phase 6, ADR 0011. Usage: `python/deq-shapes/README.md`, `rust/deq-shapes/README.md`, `rust/deq-cli/README.md`, `packages/cli/README.md`.

## Parity

- Core (TypeScript) is the reference. A change to rendering, options, errors or the flag lands in core, Python and Rust in the same PR, then `pnpm --filter @0xdolan/deq-core fixtures`.
- Ports read generated data only: `deq_shapes/data/shapes.json` and `rust/deq-shapes/data/shapes.json` (from `pnpm --filter @0xdolan/deq-core generate`). Never hand-edit them.
- SVG and PDF must match `spec/fixtures/` byte for byte (`test_parity.py`, `rust/deq-shapes/tests/parity.rs`). Follow JavaScript number formatting (`format.rs`, `_format.py`); messages and error codes match core's `DeqError`.
- Rasters are compared by dimensions and signatures only. Rust WebP is lossless (`--quality` affects JPG only).
- Ports write `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp`, `ico`; any other format must exit 4 with `format "X" is only available in the Node CLI (npx @0xdolan/deq-cli)`.

- Leet and patterns (ADR 0015, from 9b): ports read the tables from generated data, use mulberry32 (`Random` in `packages/generator/src/random.ts`; `below(n) = floor(next() * n / 2**32)`), and must write every file in `spec/fixtures/leet/` byte for byte and decode every `decoded` case.

## CLI

- `spec/cli.json` is the single source of commands, flags, exit codes and formats. After editing it run `pnpm --filter @0xdolan/deq-cli generate` (help texts and completions for all three CLIs); a test fails when a copy is stale.
- Parsers are hand-written in each language and must give identical messages; no argument-parsing libraries.
- Exit codes: 0 ok, 1 invalid shape/option/spec, 2 usage (adds `Run "deq <cmd> --help" for usage.`), 3 file error, 4 Node-only format.
- Writing is safe: check every target before writing, `--force` to overwrite, never replace a directory or symlink; `validate` refuses symlinks, non-regular files and files over 256 KB.
- New behaviour gets a case in `spec/fixtures/cli-cases.json`, then `pnpm --filter @0xdolan/deq-cli fixtures` (records the Node results in `spec/fixtures/cli/`). Python (`test_cli_cases.py`) and Rust (`rust/deq-cli/tests/cases.rs`) replay every case on Linux, macOS and Windows.

## Rust rules

- MSRV 1.85: no let-chains; use `is_some_and`, `is_none_or` or nested `if`.
- No `unwrap`, `expect` or `panic` (tests return `Result<(), String>`), no `unsafe`; clippy pedantic with `-D warnings`.
- New crates need exact versions, at least 7 days old, and a passing `cargo deny check`.
