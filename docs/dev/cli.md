---
title: Command line
description: The deq command-line tool, with the same interface in Node.js, Python and Rust.
sidebar:
  order: 2
---

The three `deq` commands share one interface, the same messages and the same exit codes. The [commands reference](../api/commands.md) lists every option and exit code.

```sh
npm install --global @0xdolan/deq-cli   # or: pip install deq-shapes, cargo install deq-cli

deq list                                # every shape id
deq info sun-rays                       # names, parameters and code point
deq render sun-rays --size 256          # sun-rays.svg in the current folder
deq render sun-rays --format png --out -  > sun-rays.png
deq flag --variant outline
deq completion zsh > ~/.zfunc/_deq
```

The Node.js tool writes every export format. The Python and Rust tools write `svg`, `svg-layered`, `svg-sprite`, `pdf`, `png`, `jpg`, `webp` and `ico`, and exit with code 4 for other formats.
