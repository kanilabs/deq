# @0xdolan/deq-cli

The `deq` command-line tool for Node.js: [Deq](https://github.com/kanilabs/deq) shapes, traditional Kurdish tattoo (deq) motifs, in every format of [`@0xdolan/deq-exporters`](../exporters). The Python (`pip install deq-shapes`) and Rust (`cargo install deq-cli`) CLIs share its interface, messages and exit codes and write a core subset of the formats ([ADR 0011](../../docs/decisions/0011-ports-and-clis.md)).

```sh
npx @0xdolan/deq-cli list
npm install --global @0xdolan/deq-cli   # then: deq --help
```

Requires Node 24 or later. Formats: all 23 of the exporters, including `ai`, `eps`, `psd`, `avif`, `favicon`, `jsx`, `vue`, `svelte` and `figma`.

## Commands

| Command                  | What it does                                                   |
| ------------------------ | -------------------------------------------------------------- |
| `deq list`               | List the shapes (`--category`, `--json`).                      |
| `deq info <shape>`       | Names, layers and parameters of a shape (`--json`).            |
| `deq render <shape...>`  | Render shapes to files, or to stdout with `--out -`.           |
| `deq export <shape...>`  | Export in several formats and sizes (`--all` for every shape). |
| `deq flag`               | Draw the flag of Kurdistan.                                    |
| `deq leet [text]`        | Write text as Deq Leet, or read it back with `--decode`.       |
| `deq generate`           | Draw a seeded band, grid, rosette or border pattern.           |
| `deq validate <file>`    | Check a shape spec file and render every parameter variant.    |
| `deq completion <shell>` | Print a bash, zsh, fish or PowerShell completion script.       |

```sh
deq render roj-half-sun --size 48 --color "#d4a017" --out sun.svg
deq render kurdish-sun --param rays=12 --format png --size 512
deq export --all --format svg,pdf --sizes 24,48 --out icons/
deq flag --format png --width 1200
deq leet "Hello Kurdistan" --level advanced --seed 7 --out hello.svg
deq leet --decode hello.svg
deq generate --kind rosette --petals 12 --format png --size 48
```

Run `deq <command> --help` for every option. Exit codes: 0 success, 1 invalid shape, option or spec,
2 bad command line, 3 file error (existing files need `--force`), 4 format only in the Node CLI.

The package also exports `main`, `parseArgs`, `validateSpec` and the generated `CLI` description for tools that embed the CLI.

License: GPL-3.0-or-later.
