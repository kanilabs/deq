import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { hasShape } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import { LOCALES } from "../src/i18n/index.ts";
import { PROJECTS, previewUrl, SANDBOX, screenshot, SHOT_WIDTHS } from "../src/lib/showcase.ts";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));

describe("showcase", () => {
  it("lists projects with unique ids, https links, known shapes and three descriptions", () => {
    expect(PROJECTS.length).toBeGreaterThan(0);
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(PROJECTS.length);
    for (const project of PROJECTS) {
      expect(project.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
      expect(previewUrl(project.url)).toBe(project.url);
      if (project.repo !== undefined) expect(project.repo).toMatch(/^https:\/\/github\.com\//u);
      expect(project.shapes.length).toBeGreaterThan(0);
      for (const id of project.shapes) expect(hasShape(id), `${project.id}: ${id}`).toBe(true);
      for (const locale of LOCALES) expect(project.description[locale].trim()).not.toBe("");
    }
  });

  it("has a screenshot of every project at every width, under 200 KiB", () => {
    for (const project of PROJECTS) {
      for (const width of SHOT_WIDTHS) {
        const file = join(PUBLIC, "showcase", `${project.id}-${String(width)}.webp`);
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size).toBeLessThan(200 * 1024);
      }
    }
  });

  it("builds screenshot URLs", () => {
    expect(screenshot("roj", "/deq/")).toEqual({
      src: "/deq/showcase/roj-640.webp",
      srcset: "/deq/showcase/roj-640.webp 640w, /deq/showcase/roj-1280.webp 1280w",
    });
    expect(screenshot("roj").src.endsWith("showcase/roj-640.webp")).toBe(true);
  });

  it("refuses preview URLs that are not plain https", () => {
    expect(() => previewUrl("http://example.org/")).toThrow("Not an https");
    expect(() => previewUrl(["javascript", "alert(1)"].join(":"))).toThrow("Not an https");
    expect(() => previewUrl("https://user:pw@example.org/")).toThrow("Not an https");
  });

  it("never lets a preview share this site's origin", () => {
    expect(SANDBOX.split(" ")).not.toContain("allow-same-origin");
    expect(SANDBOX.split(" ")).not.toContain("allow-top-navigation");
  });
});
