/**
 * Generates the TypeScript API references in `docs/api/<name>.md` (ADR 0021) from each
 * package's public exports in `src/index.ts` and their TSDoc comments, using the TypeScript
 * compiler API. The page intro is the package's leading doc comment. Exports from the generated
 * per-shape module (`src/generated/icons.ts`) are summarised, not listed one by one.
 *
 *   node scripts/api-docs.ts           write the files
 *   node scripts/api-docs.ts --check   fail if a file is out of date
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const API_DIR = join(ROOT, "docs", "api");

/** The packages with a reference page, in sidebar order. */
export const PACKAGES = [
  "core",
  "exporters",
  "generator",
  "icons",
  "react",
  "vue",
  "svelte",
  "elements",
  "cli",
] as const;

const SIG_FORMAT: ts.TypeFormatFlags =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType;
const FORMAT: ts.TypeFormatFlags = SIG_FORMAT | ts.TypeFormatFlags.WriteArrowStyleSignature;

function oneLine(s: string): string {
  return s.replace(/\s+/gu, " ").trim();
}

/** Comment text with `{@link X}` written as code. */
function text(parts: ts.SymbolDisplayPart[] | undefined): string {
  return ts
    .displayPartsToString(parts ?? [])
    .replace(/\{@link\s+([^}\s]+)\s*\}/gu, "`$1`")
    .trim();
}

/** True when the symbol is declared in this repository, not in a dependency or lib file. */
function ownMember(p: ts.Symbol): boolean {
  return (p.declarations ?? []).some((d) => !d.getSourceFile().fileName.includes("/node_modules/"));
}

function docOf(sym: ts.Symbol, checker: ts.TypeChecker): string {
  const tags = sym
    .getJsDocTags(checker)
    .filter((t) => t.name === "throws" || t.name === "deprecated")
    .map((t) => `**@${t.name}** ${text(t.text)}`);
  return [text(sym.getDocumentationComment(checker)), ...tags].filter(Boolean).join("\n\n");
}

/** The `/** … *\/` comment right before the statement that declares a re-export. */
function statementDoc(exp: ts.Symbol): string {
  let node: ts.Node | undefined = exp.declarations?.[0];
  while (node && !ts.isSourceFile(node.parent)) node = node.parent;
  if (!node) return "";
  const source = node.getSourceFile().text;
  const ranges = ts.getLeadingCommentRanges(source, node.pos) ?? [];
  const last = ranges.at(-1);
  // A comment at the start of the file is the package's own doc comment.
  const comment = last && last.pos > 0 ? source.slice(last.pos, last.end) : "";
  if (!comment.startsWith("/**")) return "";
  return comment
    .slice(3, -2)
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/u, ""))
    .join("\n")
    .replace(/\{@link\s+([^}\s]+)\s*\}/gu, "`$1`")
    .trim();
}

function members(sym: ts.Symbol, checker: ts.TypeChecker): string[] {
  const type = checker.getDeclaredTypeOfSymbol(sym);
  return checker
    .getPropertiesOfType(type)
    .filter((p) => ownMember(p) && p.getName() !== "prototype")
    .map((p) => {
      const decl = p.valueDeclaration ?? p.declarations?.[0];
      const optional = (p.flags & ts.SymbolFlags.Optional) !== 0 ? "?" : "";
      const t = decl
        ? checker.typeToString(checker.getTypeOfSymbolAtLocation(p, decl), undefined, FORMAT)
        : "unknown";
      const doc = oneLine(text(p.getDocumentationComment(checker)));
      return `- \`${p.getName()}${optional}: ${oneLine(t)}\`${doc ? `: ${doc}` : ""}`;
    });
}

/** The leading doc comment of `src/index.ts`, without the `@packageDocumentation` tag. */
function intro(source: string, npm: string): { description: string; body: string } {
  const comment = /^\/\*\*([\s\S]*?)\*\//u.exec(source)?.[1];
  if (comment === undefined) throw new Error(`${npm}: src/index.ts has no leading doc comment`);
  const text = comment
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/u, ""))
    .filter((line) => !line.startsWith("@packageDocumentation"))
    .join("\n")
    .replace(/\{@link\s+([^}\s]+)\s*\}/gu, "`$1`")
    .trim();
  const prefix = `${npm}: `;
  const body = text.startsWith(prefix) ? text.slice(prefix.length) : text;
  const first = oneLine(body.split("\n\n")[0] ?? "");
  const sentence = /^.*?[.!?](?=\s|$)/u.exec(first)?.[0] ?? first;
  const description = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return { description, body: body.charAt(0).toUpperCase() + body.slice(1) };
}

export type ApiPackage = (typeof PACKAGES)[number];

/** The reference page of a package. */
export function apiDocPath(name: ApiPackage): string {
  return join(API_DIR, `${name}.md`);
}

/** The Markdown text of one package's API reference. */
export function generateApiDoc(name: ApiPackage): string {
  const order = PACKAGES.indexOf(name) + 1;
  const pkg = join(ROOT, "packages", name);
  const npm = `@0xdolan/deq-${name}`;
  const config = ts.getParsedCommandLineOfConfigFile(
    join(pkg, "tsconfig.build.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
      },
    },
  );
  if (!config) throw new Error(`${npm}: cannot read tsconfig.build.json`);
  const entry = join(pkg, "src", "index.ts");
  const generated = join(pkg, "src", "generated", "icons.ts");
  const program = ts.createProgram(
    existsSync(generated) ? [entry, generated] : [entry],
    config.options,
  );
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const moduleSym = source && checker.getSymbolAtLocation(source);
  if (!moduleSym) throw new Error(`${npm}: cannot load src/index.ts`);

  const sections = {
    Functions: [] as string[],
    Classes: [] as string[],
    Constants: [] as string[],
    Interfaces: [] as string[],
    Types: [] as string[],
  };
  const perShape: string[] = [];
  const shapeModule = program.getSourceFile(generated);
  const shapeSym = shapeModule && checker.getSymbolAtLocation(shapeModule);
  const shapeNames = new Set(
    shapeSym ? checker.getExportsOfModule(shapeSym).map((s) => s.getName()) : [],
  );
  const exports = checker
    .getExportsOfModule(moduleSym)
    .sort((a, b) => (a.getName() < b.getName() ? -1 : 1));
  for (const exp of exports) {
    const name = exp.getName();
    if (shapeNames.has(name) && name !== "icons") {
      perShape.push(name);
      continue;
    }
    const sym = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
    const decl = sym.valueDeclaration ?? sym.declarations?.[0];
    if (!decl) throw new Error(`${npm}: cannot resolve the export ${name}`);
    // An export specifier's own comment documents a re-export the checker cannot read (.svelte).
    const doc = docOf(sym, checker) || statementDoc(exp);
    const block = (sig: string, extra: string[] = []): string =>
      [
        `### \`${name}\``,
        "",
        "```ts",
        sig,
        "```",
        ...(doc ? ["", doc] : []),
        ...(extra.length ? ["", ...extra] : []),
      ].join("\n");
    if (sym.flags & ts.SymbolFlags.Function) {
      const type = checker.getTypeOfSymbolAtLocation(sym, decl);
      const sigs = checker
        .getSignaturesOfType(type, ts.SignatureKind.Call)
        .map((s) => `function ${name}${checker.signatureToString(s, undefined, SIG_FORMAT)}`);
      sections.Functions.push(block(sigs.join("\n")));
    } else if (sym.flags & ts.SymbolFlags.Class) {
      sections.Classes.push(block(`class ${name}`, members(sym, checker)));
    } else if (sym.flags & ts.SymbolFlags.Variable) {
      const t = checker.typeToString(
        checker.getTypeOfSymbolAtLocation(sym, decl),
        undefined,
        FORMAT,
      );
      sections.Constants.push(block(`const ${name}: ${oneLine(t)}`));
    } else if (sym.flags & ts.SymbolFlags.Interface) {
      sections.Interfaces.push(block(`interface ${name}`, members(sym, checker)));
    } else if (sym.flags & ts.SymbolFlags.TypeAlias && ts.isTypeAliasDeclaration(decl)) {
      sections.Types.push(block(`type ${name} = ${oneLine(decl.type.getText())}`));
    } else {
      throw new Error(`${npm}: unsupported export kind for ${name}`);
    }
  }
  const { description, body } = intro(source.text, npm);
  const out = [
    "---",
    `title: "${npm}"`,
    `description: ${JSON.stringify(description)}`,
    "sidebar:",
    `  order: ${String(order)}`,
    "---",
    "",
    "<!-- Generated by scripts/api-docs.ts from the TSDoc comments; do not edit. -->",
    "",
    body,
    "",
    `Source: [\`packages/${name}\`](../../packages/${name}/). Install with \`npm install ${npm}\`.`,
  ];
  if (perShape.length > 0) {
    out.push(
      "",
      "## Per-shape exports",
      "",
      `${String(perShape.length)} generated exports, one per shape, such as ${perShape
        .slice(0, 3)
        .map((n) => `\`${n}\``)
        .join(", ")}. The [icon list](https://kanilabs.github.io/deq/icons/) shows every shape.`,
    );
  }
  for (const [title, blocks] of Object.entries(sections)) {
    if (blocks.length === 0) continue;
    out.push("", `## ${title}`, "", blocks.join("\n\n"));
  }
  return `${out.join("\n")}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  let stale = false;
  mkdirSync(API_DIR, { recursive: true });
  for (const name of PACKAGES) {
    const file = apiDocPath(name);
    const doc = generateApiDoc(name);
    if (!check) {
      writeFileSync(file, doc);
      continue;
    }
    let current = "";
    try {
      current = readFileSync(file, "utf8");
    } catch {
      // A missing file is out of date.
    }
    if (current !== doc) {
      console.error(`docs/api/${name}.md is out of date: run \`just api-docs\``);
      stale = true;
    }
  }
  if (stale) process.exit(1);
}
