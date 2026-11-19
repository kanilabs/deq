/**
 * The spec-driven argument parser every `deq` port implements the same way (ADR 0011):
 * same rules, same messages, so the CLI cases in `spec/fixtures/cli-cases.json` pass
 * against each of them.
 */
import type { CliData, Command, Flag } from "./types.js";

/** A parsed flag value. Pairs keep their order; lists keep the given order. */
export type FlagValue =
  boolean | number | string | readonly string[] | readonly number[] | readonly [string, string][];

export type Parsed =
  | { readonly kind: "help"; readonly text: string }
  | { readonly kind: "version"; readonly text: string }
  | {
      readonly kind: "run";
      readonly command: Command;
      readonly args: readonly string[];
      readonly flags: ReadonlyMap<string, FlagValue>;
    };

/** A command-line mistake: exit code 2. `command` names the help to point to. */
export class UsageError extends Error {
  constructor(
    message: string,
    readonly command: string | undefined,
  ) {
    super(message);
    this.name = "UsageError";
  }
}

const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
/** Up to 10 digits, so seeds up to 4294967295 fit. */
const INT = /^-?\d{1,10}$/;
const UINT = /^\d{1,9}$/;
const PAIR = /^([^=]+)=(.*)$/s;

function convert(flag: Flag, raw: string, command: string): FlagValue {
  const fail = (what: string): never => {
    throw new UsageError(`option --${flag.name}: "${raw}" ${what}`, command);
  };
  const choices = flag.choices ?? [];
  switch (flag.type) {
    case "number":
      return NUMBER.test(raw) ? Number(raw) : fail("is not a number");
    case "int":
      return INT.test(raw) ? Number(raw) : fail("is not an integer");
    case "choice":
      return choices.includes(raw) ? raw : fail(`is not one of ${choices.join(", ")}`);
    case "list":
    case "intlist": {
      const items = raw.split(",");
      // A list without choices (colours, shape ids) is free text and may repeat items.
      if (flag.type === "list" && flag.choices === undefined) return items;
      const seen = new Set<string>();
      for (const item of items) {
        if (flag.type === "list" && !choices.includes(item)) {
          throw new UsageError(
            `option --${flag.name}: "${item}" is not one of ${choices.join(", ")}`,
            command,
          );
        }
        if (flag.type === "intlist" && !UINT.test(item)) {
          throw new UsageError(`option --${flag.name}: "${item}" is not an integer`, command);
        }
        if (seen.has(item)) {
          throw new UsageError(`option --${flag.name} lists "${item}" twice`, command);
        }
        seen.add(item);
      }
      return flag.type === "list" ? items : items.map(Number);
    }
    default:
      return raw;
  }
}

/** Parse `argv` (without the program name) against the shared CLI data. */
export function parseArgs(data: CliData, argv: readonly string[]): Parsed {
  const version = { kind: "version", text: `${data.name} ${data.version}\n` } as const;
  const [first] = argv;
  if (first === undefined) throw new UsageError("missing command", undefined);
  if (first === "-h" || first === "--help") return { kind: "help", text: data.help[""] ?? "" };
  if (first === "-V" || first === "--version") return version;
  if (first.startsWith("-")) throw new UsageError(`unknown option ${first}`, undefined);
  const command = data.commands.find((c) => c.name === first);
  if (!command) throw new UsageError(`unknown command "${first}"`, undefined);
  const name = command.name;
  const flags = new Map<string, FlagValue>();
  const args: string[] = [];
  let rest = false;
  for (let i = 1; i < argv.length; i++) {
    const tok = argv[i] ?? "";
    if (rest || tok === "-" || !tok.startsWith("-")) {
      args.push(tok);
      continue;
    }
    if (tok === "--") {
      rest = true;
      continue;
    }
    if (tok === "-h") return { kind: "help", text: data.help[name] ?? "" };
    if (tok === "-V") return version;
    if (!tok.startsWith("--")) throw new UsageError(`unknown option ${tok}`, name);
    const eq = tok.indexOf("=");
    const key = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
    const inline = eq === -1 ? undefined : tok.slice(eq + 1);
    if ((key === "help" || key === "version") && inline === undefined) {
      return key === "help" ? { kind: "help", text: data.help[name] ?? "" } : version;
    }
    const flag = command.flags.find((f) => f.name === key);
    if (!flag) throw new UsageError(`unknown option --${key}`, name);
    if (flag.type === "bool") {
      if (inline !== undefined) throw new UsageError(`option --${key} takes no value`, name);
      if (flags.has(key)) throw new UsageError(`option --${key} given twice`, name);
      flags.set(key, true);
      continue;
    }
    let raw = inline;
    if (raw === undefined) {
      i++;
      raw = argv[i];
    }
    if (raw === undefined) throw new UsageError(`option --${key} needs a value`, name);
    if (flag.type === "pair") {
      const m = PAIR.exec(raw);
      if (!m)
        throw new UsageError(
          `option --${key}: "${raw}" is not ${flag.value ?? "name=value"}`,
          name,
        );
      const pairs = (flags.get(key) ?? []) as [string, string][];
      const k = m[1] ?? "";
      if (pairs.some(([p]) => p === k))
        throw new UsageError(`option --${key} sets "${k}" twice`, name);
      flags.set(key, [...pairs, [k, m[2] ?? ""]]);
      continue;
    }
    if (flags.has(key)) throw new UsageError(`option --${key} given twice`, name);
    flags.set(key, convert(flag, raw, name));
  }
  checkArgs(command, args);
  return { kind: "run", command, args, flags };
}

function checkArgs(command: Command, args: readonly string[]): void {
  const name = command.name;
  const [spec] = command.args;
  if (!spec) {
    if (args[0] !== undefined) throw new UsageError(`unexpected argument "${args[0]}"`, name);
    return;
  }
  const label = `<${spec.name}${spec.variadic ? "..." : ""}>`;
  if (args.length === 0 && !spec.optional) throw new UsageError(`missing argument ${label}`, name);
  if (!spec.variadic && args.length > 1) {
    throw new UsageError(`unexpected argument "${args[1] ?? ""}"`, name);
  }
  const choices = spec.choices;
  if (choices) {
    for (const a of args) {
      if (!choices.includes(a)) {
        throw new UsageError(`argument ${label}: "${a}" is not one of ${choices.join(", ")}`, name);
      }
    }
  }
}
