/**
 * Sets the one version every Deq package shares (npm, PyPI, crates.io, fonts, site), or checks
 * that they all agree. Python gets the PEP 440 spelling of the same version (1.0.0-rc.1 →
 * 1.0.0rc1); `deq_shapes.__version__` keeps the SemVer spelling so all three CLIs print the same.
 *
 *   node scripts/version.ts 1.0.0-rc.1     write the version into every manifest
 *   node scripts/version.ts --check [v]    fail if the manifests disagree (or differ from v)
 *
 * `just version <v>` runs this and then regenerates the files that embed the version.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** SemVer 2.0.0 without build metadata; pre-releases are limited to alpha, beta and rc. */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.(0|[1-9]\d*))?$/;

/** The PEP 440 spelling of a SemVer version: 1.0.0-rc.1 → 1.0.0rc1, 1.0.0-alpha.2 → 1.0.0a2. */
export function pep440(version: string): string {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`not a Deq version: ${version}`);
  const [, major, minor, patch, pre, n] = match;
  const base = `${major ?? ""}.${minor ?? ""}.${patch ?? ""}`;
  if (!pre) return base;
  const tag = { alpha: "a", beta: "b", rc: "rc" }[pre] ?? pre;
  return `${base}${tag}${n ?? ""}`;
}

/** One place a version is written: a file, a pattern whose group 2 is the version, a spelling. */
interface Site {
  readonly file: string;
  readonly pattern: RegExp;
  readonly python?: boolean;
}

/** The folders of `parent` that hold a `manifest` file. */
function dirs(parent: string, manifest: string): string[] {
  return readdirSync(join(ROOT, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, parent, entry.name, manifest)))
    .map((entry) => `${parent}/${entry.name}`)
    .sort();
}

const JSON_VERSION = /^(\s{2}"version": ")([^"]+)(")/m;
const TOML_VERSION = /^(version = ")([^"]+)(")/m;

export function sites(): Site[] {
  const pyScripts = dirs("scripts", "pyproject.toml").map((dir) => `${dir}/pyproject.toml`);
  const npm = [
    "package.json",
    ...[...dirs("packages", "package.json"), "apps/site", ...dirs("examples", "package.json")].map(
      (dir) => `${dir}/package.json`,
    ),
  ];
  return [
    ...npm.map((file) => ({ file, pattern: JSON_VERSION })),
    { file: "Cargo.toml", pattern: TOML_VERSION },
    {
      file: "rust/deq-cli/Cargo.toml",
      pattern: /^(deq-shapes = \{ path = "\.\.\/deq-shapes", version = "=)([^"]+)(")/m,
    },
    { file: "rust/deq-shapes/README.md", pattern: /^(deq-shapes = ")([^"]+)(")/m },
    { file: "docs/api/rust.md", pattern: /^(deq-shapes = ")([^"]+)(")/m },
    ...["pyproject.toml", "python/deq-shapes/pyproject.toml", ...pyScripts].map((file) => ({
      file,
      pattern: TOML_VERSION,
      python: true,
    })),
    {
      file: "python/deq-shapes/src/deq_shapes/__init__.py",
      pattern: /^(__version__: Final = ")([^"]+)(")/m,
    },
  ];
}

function read(site: Site): { text: string; found: string } {
  const text = readFileSync(join(ROOT, site.file), "utf8");
  const found = site.pattern.exec(text)?.[2];
  if (found === undefined) throw new Error(`${site.file}: no version found`);
  return { text, found };
}

/** Writes `version` everywhere; returns the files that changed. */
export function setVersion(version: string): string[] {
  const py = pep440(version);
  const changed: string[] = [];
  for (const site of sites()) {
    const { text, found } = read(site);
    const want = site.python ? py : version;
    if (found === want) continue;
    writeFileSync(join(ROOT, site.file), text.replace(site.pattern, `$1${want}$3`));
    changed.push(site.file);
  }
  return changed;
}

/** Lists every manifest whose version is not `version` (default: the root package.json's). */
export function checkVersion(version?: string): string[] {
  const want = version ?? read({ file: "package.json", pattern: JSON_VERSION }).found;
  const py = pep440(want);
  return sites()
    .map((site) => ({ site, found: read(site).found }))
    .filter(({ site, found }) => found !== (site.python ? py : want))
    .map(({ site, found }) => `${site.file}: ${found}, expected ${site.python ? py : want}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [first, second] = process.argv.slice(2);
  try {
    if (first === "--check") {
      const wrong = checkVersion(second?.replace(/^v/, ""));
      if (wrong.length > 0) throw new Error(`versions disagree:\n  ${wrong.join("\n  ")}`);
      console.log("version: ok");
    } else if (first && SEMVER.test(first)) {
      for (const file of setVersion(first)) console.log(`updated ${file}`);
    } else {
      throw new Error("usage: node scripts/version.ts <x.y.z[-rc.n]> | --check [version]");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
