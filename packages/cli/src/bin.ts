#!/usr/bin/env node
/** The `deq` executable. */
import process from "node:process";

import { main } from "./cli.js";

process.exitCode = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (data) => process.stdout.write(data),
  stderr: (text) => process.stderr.write(text),
});
