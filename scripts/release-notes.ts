/**
 * Prints the `CHANGELOG.md` section of one version, for the GitHub release notes (ADR 0024).
 * Fails when the section is missing or empty, so a release never goes out without notes.
 *
 *   node scripts/release-notes.ts 1.0.0-rc.1
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The body of the `## [version]` section, without its heading. */
export function releaseNotes(changelog: string, version: string): string {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start < 0) throw new Error(`CHANGELOG.md has no "## [${version}]" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## ["));
  const body = (end < 0 ? rest : rest.slice(0, end))
    .filter((line) => !/^\[[^\]]+\]: /.test(line))
    .join("\n")
    .trim();
  if (body === "") throw new Error(`CHANGELOG.md: the ${version} section is empty`);
  return `${body}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2]?.replace(/^v/, "");
  try {
    if (!version) throw new Error("usage: node scripts/release-notes.ts <version>");
    const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
    process.stdout.write(releaseNotes(changelog, version));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
