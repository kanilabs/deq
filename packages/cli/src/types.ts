/** The shared CLI data built from `spec/cli.json` (see scripts/generate.ts). */

export type FlagType =
  "bool" | "string" | "number" | "int" | "choice" | "list" | "intlist" | "pair";

/** A command-line flag with its choices resolved. */
export interface Flag {
  readonly name: string;
  readonly short?: string;
  readonly type: FlagType;
  readonly value?: string;
  readonly choices?: readonly string[];
  readonly default?: string;
  readonly complete?: string;
  readonly option?: string;
  readonly help: string;
}

export interface Arg {
  readonly name: string;
  readonly variadic?: boolean;
  readonly optional?: boolean;
  readonly choices?: readonly string[];
  readonly complete?: string;
  readonly help: string;
}

export interface Command {
  readonly name: string;
  readonly summary: string;
  readonly args: readonly Arg[];
  readonly flags: readonly Flag[];
}

/** Everything a CLI needs besides the renderers. */
export interface CliData {
  readonly name: string;
  readonly version: string;
  readonly formats: { readonly all: readonly string[]; readonly ports: readonly string[] };
  readonly globalFlags: readonly Flag[];
  readonly exitCodes: readonly { readonly code: number; readonly meaning: string }[];
  readonly commands: readonly Command[];
  /** Help per command; the key "" is the top-level help. */
  readonly help: Readonly<Record<string, string>>;
  readonly completions: Readonly<Record<string, string>>;
}
