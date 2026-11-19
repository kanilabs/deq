/**
 * Builds the data every `deq` CLI shares from `spec/cli.json` (ADR 0011): the resolved
 * command table, the help texts and the shell completions. Written to the Node package and
 * copied to the Python and Rust ports so the three print the same help and completions.
 *
 *   node scripts/generate.ts           write the files
 *   node scripts/generate.ts --check   fail if a file is out of date
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { listFlagVariants, listShapes } from "@0xdolan/deq-core";

import type { Arg, CliData, Command, Flag } from "../src/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "..", "..", "..");
const SPEC = join(ROOT, "spec", "cli.json");
export const TS_FILE = join(here, "..", "src", "generated", "cli.ts");
export const PORT_FILES = [
  join(ROOT, "python", "deq-shapes", "src", "deq_shapes", "data", "cli.json"),
  join(ROOT, "rust", "deq-cli", "data", "cli.json"),
];
const WIDTH = 80;

interface RawFlag extends Omit<Flag, "choices"> {
  readonly choices?: readonly string[] | string;
}
interface RawSpec {
  readonly name: string;
  readonly summary: string;
  readonly globalFlags: readonly Flag[];
  readonly exitCodes: CliData["exitCodes"];
  readonly formats: Readonly<Record<string, readonly string[]>>;
  readonly flagSets: Readonly<Record<string, readonly RawFlag[]>>;
  readonly commands: readonly {
    readonly name: string;
    readonly summary: string;
    readonly args: readonly Arg[];
    readonly flags: readonly RawFlag[];
    readonly use?: readonly string[];
    /** Flags of the used sets that this command leaves out. */
    readonly omit?: readonly string[];
  }[];
}

function resolveChoices(spec: RawSpec, ref: readonly string[] | string): readonly string[] {
  if (typeof ref !== "string") return ref;
  if (ref === "flag.variants") return listFlagVariants();
  const [group, key] = ref.split(".");
  const list = group === "formats" && key ? spec.formats[key] : undefined;
  if (!list) throw new Error(`spec/cli.json: unknown choices reference ${ref}`);
  return list;
}

/** Wrap `text` to `WIDTH`, indenting continuation lines by `indent`. */
function wrap(text: string, indent: number, first: number): string {
  const lines: string[] = [];
  let line = "";
  let room = WIDTH - first;
  for (const word of text.split(" ")) {
    if (line !== "" && line.length + 1 + word.length > room) {
      lines.push(line);
      line = word;
      room = WIDTH - indent;
    } else {
      line = line === "" ? word : `${line} ${word}`;
    }
  }
  lines.push(line);
  return lines.join(`\n${" ".repeat(indent)}`);
}

function table(rows: readonly (readonly [string, string])[]): string {
  const col = Math.min(Math.max(...rows.map(([l]) => l.length)), 28) + 4;
  return rows
    .map(([label, text]) => {
      const head = `  ${label}`;
      if (head.length + 2 > col) return `${head}\n${" ".repeat(col)}${wrap(text, col, col)}`;
      return `${head.padEnd(col)}${wrap(text, col, col)}`;
    })
    .join("\n");
}

function flagLabel(f: Flag): string {
  const long = `--${f.name}`;
  const name = f.short ? `-${f.short}, ${long}` : `    ${long}`;
  if (f.type === "bool") return name;
  return `${name} <${f.value ?? f.name}>`;
}

function flagHelp(f: Flag): string {
  if (!f.choices) return f.help;
  return `${f.help} Values: ${f.choices.join(", ")}.`;
}

function argLabel(a: Arg): string {
  const core = `<${a.name}${a.variadic ? "..." : ""}>`;
  return a.optional ? `[${core}]` : core;
}

function commandHelp(name: string, c: Command, globals: readonly Flag[]): string {
  const usage = [name, c.name, ...c.args.map(argLabel), "[options]"].join(" ");
  const parts = [`Usage: ${usage}`, c.summary];
  if (c.args.length > 0) {
    parts.push(
      `Arguments:\n${table(c.args.map((a) => [argLabel(a), a.choices ? a.help : a.help]))}`,
    );
  }
  parts.push(
    `Options:\n${table([...c.flags, ...globals].map((f) => [flagLabel(f), flagHelp(f)]))}`,
  );
  return `${parts.join("\n\n")}\n`;
}

function topHelp(spec: RawSpec, version: string, commands: readonly Command[]): string {
  return `${[
    `${spec.name} ${version}: ${spec.summary}`,
    `Usage: ${spec.name} <command> [options]`,
    `Commands:\n${table(commands.map((c) => [c.name, c.summary]))}`,
    `Options:\n${table(spec.globalFlags.map((f) => [flagLabel(f), flagHelp(f)]))}`,
    `Exit codes:\n${table(spec.exitCodes.map((e) => [String(e.code), e.meaning]))}`,
    `Run "${spec.name} <command> --help" for the options of a command.`,
  ].join("\n\n")}\n`;
}

// ---------------------------------------------------------------- completions

/** First sentence of a help text, for completion descriptions. */
const brief = (help: string): string => {
  const end = help.search(/\.(\s|$)/);
  return end === -1 ? help : help.slice(0, end);
};
const sq = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;

function valueWords(f: Flag | Arg, shapes: readonly string[]): readonly string[] | undefined {
  if (f.choices) return f.choices;
  if (f.complete === "shape") return shapes;
  return undefined;
}

function bash(
  name: string,
  cmds: readonly Command[],
  globals: readonly Flag[],
  shapes: readonly string[],
): string {
  const globalWords = globals.flatMap((f) => [`--${f.name}`]);
  const out = [
    `# bash completion for ${name}. Generated from spec/cli.json; do not edit.`,
    `# Install: ${name} completion bash > ~/.local/share/bash-completion/completions/${name}`,
    `_${name}() {`,
    `  local cur prev`,
    `  cur="\${COMP_WORDS[COMP_CWORD]}"`,
    `  prev="\${COMP_WORDS[COMP_CWORD-1]}"`,
    `  if [[ $COMP_CWORD -eq 1 ]]; then`,
    `    COMPREPLY=($(compgen -W "${[...cmds.map((c) => c.name), ...globalWords].join(" ")}" -- "$cur"))`,
    `    return`,
    `  fi`,
    `  case "\${COMP_WORDS[1]}" in`,
  ];
  for (const c of cmds) {
    out.push(`    ${c.name})`);
    const valued = c.flags.filter((f) => f.type !== "bool");
    if (valued.length > 0) {
      out.push(`      case "$prev" in`);
      for (const f of valued) {
        const words = valueWords(f, shapes);
        if (words)
          out.push(
            `        --${f.name}) COMPREPLY=($(compgen -W "${words.join(" ")}" -- "$cur")); return ;;`,
          );
        else if (f.complete === "file")
          out.push(`        --${f.name}) COMPREPLY=($(compgen -f -- "$cur")); return ;;`);
        else if (f.complete === "dir")
          out.push(`        --${f.name}) COMPREPLY=($(compgen -d -- "$cur")); return ;;`);
        else out.push(`        --${f.name}) return ;;`);
      }
      out.push(`      esac`);
    }
    const flags = [...c.flags.map((f) => `--${f.name}`), "--help"].join(" ");
    out.push(
      `      if [[ $cur == -* ]]; then COMPREPLY=($(compgen -W "${flags}" -- "$cur")); return; fi`,
    );
    const arg = c.args[0];
    if (arg) {
      const words = valueWords(arg, shapes);
      if (words) out.push(`      COMPREPLY=($(compgen -W "${words.join(" ")}" -- "$cur"))`);
      else if (arg.complete === "file") out.push(`      COMPREPLY=($(compgen -f -- "$cur"))`);
    }
    out.push(`      ;;`);
  }
  out.push(`  esac`, `}`, `complete -F _${name} ${name}`, ``);
  return out.join("\n");
}

const zdesc = (s: string): string => brief(s).replaceAll("[", "\\[").replaceAll("]", "\\]");

function zshAction(f: Flag | Arg, shapes: readonly string[]): string {
  const words = valueWords(f, shapes);
  if (words) return `(${words.join(" ")})`;
  if (f.complete === "file") return "_files";
  if (f.complete === "dir") return "_files -/";
  return " ";
}

function zsh(
  name: string,
  cmds: readonly Command[],
  globals: readonly Flag[],
  shapes: readonly string[],
): string {
  const gspecs = globals.map(
    (f) => sq(`(- *)`) + `{-${f.short ?? ""},--${f.name}}` + sq(`[${zdesc(f.help)}]`),
  );
  const out = [
    `#compdef ${name}`,
    `# zsh completion for ${name}. Generated from spec/cli.json; do not edit.`,
    `# Install: ${name} completion zsh > "\${fpath[1]}/_${name}"`,
    `_${name}() {`,
    `  local -a commands`,
    `  commands=(`,
    ...cmds.map((c) => `    ${sq(`${c.name}:${brief(c.summary)}`)}`),
    `  )`,
    `  if (( CURRENT == 2 )); then`,
    `    _describe -t commands ${sq(`${name} command`)} commands`,
    `    _arguments ${gspecs.join(" ")}`,
    `    return`,
    `  fi`,
    `  local cmd=\${words[2]}`,
    `  shift words`,
    `  (( CURRENT-- ))`,
    `  case $cmd in`,
  ];
  for (const c of cmds) {
    const specs = c.flags.map((f) => {
      const rep = f.type === "pair" ? "*" : "";
      const head = `${rep}--${f.name}[${zdesc(f.help)}]`;
      return sq(f.type === "bool" ? head : `${head}:${f.value ?? f.name}:${zshAction(f, shapes)}`);
    });
    specs.push(sq(`(- *)--help[Show help.]`));
    for (const a of c.args) {
      const prefix = a.variadic ? "*" : a.optional ? "::" : ":";
      const sep = a.variadic ? ":" : "";
      specs.push(sq(`${prefix}${sep}${a.name}:${zshAction(a, shapes)}`));
    }
    out.push(
      `    ${c.name})`,
      `      _arguments -S \\`,
      ...specs.map((s, i) => `        ${s}${i === specs.length - 1 ? "" : " \\"}`),
      `      ;;`,
    );
  }
  out.push(`  esac`, `}`, `_${name} "$@"`, ``);
  return out.join("\n");
}

const fq = (s: string): string => `'${s.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

function fish(
  name: string,
  cmds: readonly Command[],
  globals: readonly Flag[],
  shapes: readonly string[],
): string {
  const out = [
    `# fish completion for ${name}. Generated from spec/cli.json; do not edit.`,
    `# Install: ${name} completion fish > ~/.config/fish/completions/${name}.fish`,
    `complete -c ${name} -f`,
  ];
  for (const c of cmds) {
    out.push(
      `complete -c ${name} -n __fish_use_subcommand -a ${c.name} -d ${fq(brief(c.summary))}`,
    );
  }
  for (const f of globals) {
    out.push(
      `complete -c ${name} -n __fish_use_subcommand -s ${f.short ?? ""} -l ${f.name} -d ${fq(brief(f.help))}`,
    );
  }
  for (const c of cmds) {
    const when = `-n ${fq(`__fish_seen_subcommand_from ${c.name}`)}`;
    for (const f of c.flags) {
      let value = "";
      const words = valueWords(f, shapes);
      if (f.type !== "bool") {
        if (words) value = ` -x -a ${fq(words.join(" "))}`;
        else if (f.complete === "file" || f.complete === "dir") value = " -r -F";
        else value = " -x";
      }
      out.push(`complete -c ${name} ${when} -l ${f.name}${value} -d ${fq(brief(f.help))}`);
    }
    out.push(`complete -c ${name} ${when} -l help -d ${fq("Show help")}`);
    const arg = c.args[0];
    if (arg) {
      const words = valueWords(arg, shapes);
      if (words) out.push(`complete -c ${name} ${when} -a ${fq(words.join(" "))}`);
      else if (arg.complete === "file") out.push(`complete -c ${name} ${when} -F`);
    }
  }
  out.push("");
  return out.join("\n");
}

const pq = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const plist = (words: readonly string[]): string => `@(${words.map(pq).join(", ")})`;

function powershell(
  name: string,
  cmds: readonly Command[],
  globals: readonly Flag[],
  shapes: readonly string[],
): string {
  const out = [
    `# PowerShell completion for ${name}. Generated from spec/cli.json; do not edit.`,
    `# Install: ${name} completion powershell | Out-String | Invoke-Expression`,
    `Register-ArgumentCompleter -Native -CommandName ${name} -ScriptBlock {`,
    `    param($wordToComplete, $commandAst, $cursorPosition)`,
    `    $shapes = ${plist(shapes)}`,
    `    $commands = [ordered]@{`,
  ];
  for (const c of cmds) {
    const values = c.flags
      .filter((f) => f.type !== "bool")
      .map((f) => {
        const words = f.complete === "shape" ? "$shapes" : plist(f.choices ?? []);
        return `${pq(`--${f.name}`)} = ${words}`;
      });
    const arg = c.args[0];
    const args = !arg ? "@()" : arg.complete === "shape" ? "$shapes" : plist(arg.choices ?? []);
    out.push(
      `        ${pq(c.name)} = @{`,
      `            Flags = ${plist([...c.flags.map((f) => `--${f.name}`), "--help"])}`,
      `            Values = @{ ${values.join("; ")} }`,
      `            Args = ${args}`,
      `        }`,
    );
  }
  out.push(
    `    }`,
    `    $before = @($commandAst.CommandElements | Where-Object { $_.Extent.EndOffset -lt $cursorPosition } | ForEach-Object { $_.ToString() })`,
    `    $candidates = @()`,
    `    if ($before.Count -le 1) {`,
    `        $candidates = @($commands.Keys) + ${plist(globals.map((f) => `--${f.name}`))}`,
    `    } elseif ($commands.Contains($before[1])) {`,
    `        $spec = $commands[$before[1]]`,
    `        $prev = $before[-1]`,
    `        if ($spec.Values.ContainsKey($prev)) { $candidates = $spec.Values[$prev] }`,
    `        elseif ($wordToComplete.StartsWith('-')) { $candidates = $spec.Flags }`,
    `        else { $candidates = $spec.Args }`,
    `    }`,
    `    $candidates | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {`,
    `        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)`,
    `    }`,
    `}`,
    ``,
  );
  return out.join("\n");
}

// ---------------------------------------------------------------- data

/** Build the shared CLI data from `spec/cli.json`, the catalog and the package version. */
export function buildData(): CliData {
  const spec = JSON.parse(readFileSync(SPEC, "utf8")) as RawSpec;
  const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
    version: string;
  };
  const resolveFlag = (f: RawFlag): Flag =>
    f.choices === undefined ? (f as Flag) : { ...f, choices: resolveChoices(spec, f.choices) };
  const commands: Command[] = spec.commands.map((c) => {
    const used = (c.use ?? []).flatMap((u) => spec.flagSets[u] ?? []);
    const omit = new Set(c.omit ?? []);
    for (const name of omit) {
      if (!used.some((f) => f.name === name))
        throw new Error(`spec/cli.json: ${c.name} omits --${name}, which no used set has`);
    }
    const flags = [...c.flags, ...used.filter((f) => !omit.has(f.name))].map(resolveFlag);
    const names = new Set<string>();
    for (const f of flags) {
      if (names.has(f.name)) throw new Error(`spec/cli.json: ${c.name} repeats --${f.name}`);
      names.add(f.name);
    }
    return { name: c.name, summary: c.summary, args: c.args, flags };
  });
  const shapes = listShapes().map((s) => s.id);
  const help: Record<string, string> = { "": topHelp(spec, pkg.version, commands) };
  for (const c of commands) help[c.name] = commandHelp(spec.name, c, spec.globalFlags);
  const args = [spec.name, commands, spec.globalFlags, shapes] as const;
  const formats = spec.formats;
  if (!formats["all"] || !formats["ports"])
    throw new Error("spec/cli.json: formats.all and formats.ports are required");
  return {
    name: spec.name,
    version: pkg.version,
    formats: { all: formats["all"], ports: formats["ports"] },
    globalFlags: spec.globalFlags,
    exitCodes: spec.exitCodes,
    commands,
    help,
    completions: {
      bash: bash(...args),
      zsh: zsh(...args),
      fish: fish(...args),
      powershell: powershell(...args),
    },
  };
}

/** Every generated file and its expected text. */
export function generatedFiles(): [string, string][] {
  const data = buildData();
  const json = `${JSON.stringify({ $comment: "Generated from spec/cli.json by packages/cli/scripts/generate.ts. Do not edit: run `pnpm --filter @0xdolan/deq-cli generate`.", ...data }, null, 2)}\n`;
  const ts = [
    "// Generated from spec/cli.json by scripts/generate.ts.",
    "// Do not edit: run `pnpm --filter @0xdolan/deq-cli generate`.",
    'import type { CliData } from "../types.js";',
    "",
    `export const CLI: CliData = ${JSON.stringify(data, null, 2)};`,
    "",
  ].join("\n");
  return [[TS_FILE, ts], ...PORT_FILES.map((f): [string, string] => [f, json])];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const [file, text] of generatedFiles()) {
    if (check) {
      let current = "";
      try {
        current = readFileSync(file, "utf8");
      } catch {
        // Missing counts as stale.
      }
      if (current !== text) {
        console.error(`out of date: ${file}`);
        stale++;
      }
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
  }
  if (stale > 0) process.exit(1);
}
