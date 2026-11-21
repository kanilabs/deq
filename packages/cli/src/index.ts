/**
 * @0xdolan/deq-cli: the `deq` command-line tool for Node.js (ADR 0011).
 *
 * The executable is `deq`; `main` runs it in-process and returns the exit code.
 */
export { IoError, joinPath, main, paramValue, shapeInfo } from "./cli.js";
export type { Io } from "./cli.js";
export { CLI } from "./generated/cli.js";
export { UsageError, parseArgs } from "./parse.js";
export type { FlagValue, Parsed } from "./parse.js";
export type * from "./types.js";
export { MAX_SPEC_BYTES, checkSpec, validateSpec, variants } from "./validate.js";

/** The npm package name. */
export const packageName = "@0xdolan/deq-cli" as const;
