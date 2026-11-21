import { describe, expect, it } from "vitest";

import {
  CATALOGS,
  format,
  formatNumber,
  isLocale,
  LOCALE_INFO,
  LOCALES,
  localeFromParam,
  localePaths,
  localizedPath,
  useTranslations,
} from "../src/i18n/index.ts";
import { starlightStrings } from "../src/i18n/starlight.ts";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/gu)].map((m) => m[1]).sort();

describe("catalogs", () => {
  const keys = Object.keys(CATALOGS.en).sort();

  // The `satisfies Messages` checks catch this at compile time; this guards the
  // built JavaScript too, so a missing key always fails CI.
  it.each(LOCALES)("%s has exactly the English keys, all non-empty", (locale) => {
    const catalog = CATALOGS[locale];
    expect(Object.keys(catalog).sort()).toEqual(keys);
    for (const key of keys) {
      expect(catalog[key as keyof typeof catalog].trim(), `${locale}: ${key}`).not.toBe("");
    }
  });

  it.each(LOCALES)("%s keeps every placeholder of the English text", (locale) => {
    for (const key of keys) {
      const k = key as keyof (typeof CATALOGS)["en"];
      expect(placeholders(CATALOGS[locale][k]), `${locale}: ${key}`).toEqual(
        placeholders(CATALOGS.en[k]),
      );
    }
  });

  it("Starlight strings exist for ckb and kmr with the same keys", () => {
    const ckb = Object.keys(starlightStrings.ckb).sort();
    expect(Object.keys(starlightStrings.kmr).sort()).toEqual(ckb);
    for (const value of [
      ...Object.values(starlightStrings.ckb),
      ...Object.values(starlightStrings.kmr),
    ]) {
      expect(value.trim()).not.toBe("");
    }
  });

  it("marks only the Kurdish locales for native review, and ckb as RTL", () => {
    expect(LOCALES.filter((l) => LOCALE_INFO[l].needsReview)).toEqual(["ckb", "kmr"]);
    expect(LOCALES.filter((l) => LOCALE_INFO[l].dir === "rtl")).toEqual(["ckb"]);
  });
});

describe("helpers", () => {
  it("formats placeholders and leaves unknown ones", () => {
    expect(format("{count} of {total}", { count: 3, total: 9 })).toBe("3 of 9");
    expect(format("{missing}")).toBe("{missing}");
    expect(useTranslations("en")("icons.results", { count: 1, total: 2 })).toBe(
      format(CATALOGS.en["icons.results"], { count: 1, total: 2 }),
    );
  });

  it("formats numbers per locale", () => {
    expect(formatNumber("en", 1234)).toBe("1,234");
    expect(formatNumber("ckb", 93)).toBe("٩٣");
  });

  it("validates locales and route parameters", () => {
    expect(isLocale("ckb")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(1)).toBe(false);
    expect(localeFromParam(undefined)).toBe("en");
    expect(localeFromParam("kmr")).toBe("kmr");
    expect(() => localeFromParam("en")).toThrow(/Unknown locale/u);
    expect(() => localeFromParam("fr")).toThrow(/Unknown locale/u);
    expect(localePaths().map((p) => p.params.locale)).toEqual([undefined, "ckb", "kmr"]);
  });

  it("builds localised paths with a trailing slash", () => {
    expect(localizedPath("en", "", "/deq/")).toBe("/deq/");
    expect(localizedPath("en", "/icons", "/deq")).toBe("/deq/icons/");
    expect(localizedPath("ckb", "icons/sun-rays/", "/deq/")).toBe("/deq/ckb/icons/sun-rays/");
    expect(localizedPath("kmr")).toBe("/kmr/");
  });
});
