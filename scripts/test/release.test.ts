// Tests for the release scripts (ADR 0024), run by `pnpm test`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { releaseNotes } from "../release-notes.ts";
import { checkVersion, pep440, sites } from "../version.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("version", () => {
  it("spells pre-releases the PEP 440 way", () => {
    expect(pep440("1.0.0")).toBe("1.0.0");
    expect(pep440("1.0.0-rc.1")).toBe("1.0.0rc1");
    expect(pep440("2.3.4-alpha.2")).toBe("2.3.4a2");
    expect(pep440("2.3.4-beta.0")).toBe("2.3.4b0");
  });

  it("rejects versions the registries would spell differently", () => {
    for (const bad of ["1.0", "01.0.0", "1.0.0-rc1", "1.0.0-dev.1", "1.0.0+build"]) {
      expect(() => pep440(bad)).toThrow(/not a Deq version/);
    }
  });

  it("finds every manifest, and they agree", () => {
    const files = sites().map((site) => site.file);
    for (const file of [
      "package.json",
      "packages/core/package.json",
      "Cargo.toml",
      "rust/deq-cli/Cargo.toml",
      "python/deq-shapes/pyproject.toml",
    ]) {
      expect(files).toContain(file);
    }
    for (const file of files) expect(existsSync(join(ROOT, file)), file).toBe(true);
    expect(checkVersion()).toEqual([]);
  });

  it("reports every manifest when the expected version differs", () => {
    expect(checkVersion("9.9.9")).toHaveLength(sites().length);
  });
});

describe("release notes", () => {
  const changelog = [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "## [1.0.0-rc.1] - 2026-11-21",
    "",
    "### Added",
    "",
    "- Debian packages.",
    "",
    "## [0.1.0] - 2026-01-01",
    "",
    "- Old.",
    "",
    "[1.0.0-rc.1]: https://github.com/kanilabs/deq/releases/tag/v1.0.0-rc.1",
  ].join("\n");

  it("returns one section without its heading", () => {
    expect(releaseNotes(changelog, "1.0.0-rc.1")).toBe("### Added\n\n- Debian packages.\n");
  });

  it("drops link references from the last section", () => {
    expect(releaseNotes(changelog, "0.1.0")).toBe("- Old.\n");
  });

  it("fails without a section or with an empty one", () => {
    expect(() => releaseNotes(changelog, "2.0.0")).toThrow(/no "## \[2.0.0\]" section/);
    expect(() => releaseNotes(changelog, "Unreleased")).toThrow(/section is empty/);
  });
});
