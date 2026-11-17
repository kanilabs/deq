# deq-shapes

Python library and `deq` CLI for [Deq](https://github.com/kanilabs/deq) shapes: traditional Kurdish tattoo (deq) motifs drawn on a 24 × 24 grid. Its SVG and PDF output is byte for byte the output of `@0xdolan/deq-core`, checked against the shared golden fixtures, and the CLI shares its interface, messages and exit codes with the Node and Rust CLIs ([ADR 0011](https://github.com/kanilabs/deq/blob/main/docs/decisions/0011-ports-and-clis.md)).

```sh
pip install deq-shapes   # or: uv add deq-shapes
```

```python
from deq_shapes import list_shapes, render, render_flag
from deq_shapes.export import export_shapes

svg = render("roj-half-sun", {"size": 48, "color": "#d4a017"})
flag = render_flag({"variant": "full-color", "width": 900})
files = export_shapes("png", ["kurdish-sun"], {"render": {"size": 512}})
print(len(list_shapes()), files[0].name)
```

- `render`, `compose`, `render_flag`, `get_shape`, `list_shapes`, `list_categories` and `has_shape` mirror core; options use core's names (`strokeWidth`, `dotScale`, `params`, …).
- `deq_shapes.export.export_shapes` writes `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp` and `ico`.
- Errors are `DeqError` with core's codes (`UNKNOWN_SHAPE`, `INVALID_OPTIONS`, …) and messages.

The CLI writes the same formats; the others (AI, EPS, PSD, AVIF, favicons, components, Figma and more) are in the Node CLI: `npx @0xdolan/deq-cli`.

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
