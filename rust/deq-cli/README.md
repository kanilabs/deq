# deq-cli

The `deq` command-line tool for [Deq](https://github.com/kanilabs/deq) shapes: traditional Kurdish tattoo (deq) motifs as SVG, PDF and images. It is built on the [`deq-shapes`](https://crates.io/crates/deq-shapes) crate and shares its interface, messages and exit codes with the Node and Python CLIs ([ADR 0011](https://github.com/kanilabs/deq/blob/main/docs/decisions/0011-ports-and-clis.md)).

```sh
cargo install deq-cli
```

Formats: `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp` and `ico`. The other formats (AI, EPS, PSD, AVIF, favicons, components, Figma and more) are in the Node CLI: `npx @0xdolan/deq-cli`. WebP output is lossless here, so `--quality` only affects JPG.

## Commands

| Command                  | What it does                                                   |
| ------------------------ | -------------------------------------------------------------- |
| `deq list`               | List the shapes (`--category`, `--json`).                      |
| `deq info <shape>`       | Names, layers and parameters of a shape (`--json`).            |
| `deq render <shape...>`  | Render shapes to files, or to stdout with `--out -`.           |
| `deq export <shape...>`  | Export in several formats and sizes (`--all` for every shape). |
| `deq flag`               | Draw the flag of Kurdistan.                                    |
| `deq validate <file>`    | Check a shape spec file and render every parameter variant.    |
| `deq completion <shell>` | Print a bash, zsh, fish or PowerShell completion script.       |

```sh
deq render roj-half-sun --size 48 --color "#d4a017" --out sun.svg
deq render kurdish-sun --param rays=12 --format png --size 512
deq export --all --format svg,pdf --sizes 24,48 --out icons/
deq flag --format png --width 1200
```

Run `deq <command> --help` for every option. Exit codes: 0 success, 1 invalid shape, option or spec,
2 bad command line, 3 file error (existing files need `--force`), 4 format only in the Node CLI.

License: GPL-3.0-or-later.
