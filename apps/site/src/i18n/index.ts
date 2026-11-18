/** Locales, message lookup and localised paths for the site's own pages. */
import { ckb } from "./messages/ckb.ts";
import { en, type MessageKey, type Messages } from "./messages/en.ts";
import { kmr } from "./messages/kmr.ts";

export type { MessageKey, Messages } from "./messages/en.ts";

/** Locale codes in display order; `en` is the default and has no URL prefix. */
export const LOCALES = ["en", "ckb", "kmr"] as const;
export type Locale = (typeof LOCALES)[number];

export interface LocaleInfo {
  /** BCP-47 tag for `lang` and `hreflang`. */
  readonly lang: string;
  readonly dir: "ltr" | "rtl";
  /** The language's name in that language (used by the switcher). */
  readonly label: string;
  /** Open Graph locale. */
  readonly og: string;
  /** AI-drafted text waiting for native review (ADR 0012, Q10). */
  readonly needsReview: boolean;
}

export const LOCALE_INFO: Readonly<Record<Locale, LocaleInfo>> = {
  en: { lang: "en", dir: "ltr", label: "English", og: "en_US", needsReview: false },
  ckb: { lang: "ckb", dir: "rtl", label: "کوردیی سۆرانی", og: "ckb_IQ", needsReview: true },
  kmr: { lang: "kmr", dir: "ltr", label: "Kurmancî", og: "kmr_TR", needsReview: true },
};

export const CATALOGS: Readonly<Record<Locale, Messages>> = { en, ckb, kmr };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/** Fill `{name}` placeholders; unknown placeholders are left as they are. */
export function format(
  template: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return template.replace(/\{(\w+)\}/gu, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/** A translator bound to one locale. */
export function useTranslations(locale: Locale) {
  const catalog = CATALOGS[locale];
  return (key: MessageKey, values?: Readonly<Record<string, string | number>>): string =>
    format(catalog[key], values);
}

/** Locale-aware number formatting (Sorani uses Arabic-Indic digits). */
export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(
    LOCALE_INFO[locale].lang === "ckb" ? "ckb-IQ" : LOCALE_INFO[locale].lang,
  ).format(value);
}

/** The `[...locale]` route parameter: undefined for the default locale. */
export const localeParam = (locale: Locale): string | undefined =>
  locale === "en" ? undefined : locale;

/** `getStaticPaths` entries for one page in every locale. */
export const localePaths = (): {
  params: { locale: string | undefined };
  props: { locale: Locale };
}[] => LOCALES.map((locale) => ({ params: { locale: localeParam(locale) }, props: { locale } }));

/** Read the locale from the `[...locale]` parameter; throws on anything else. */
export function localeFromParam(param: string | undefined): Locale {
  const locale = param ?? "en";
  if (!isLocale(locale) || param === "en") throw new Error(`Unknown locale: ${String(param)}`);
  return locale;
}

/**
 * A site path for a locale, with the base path. `page` is relative to the locale root,
 * for example `icons/` or `` for the home page. Paths always end with a slash.
 */
export function localizedPath(
  locale: Locale,
  page = "",
  base: string = import.meta.env.BASE_URL,
): string {
  const root = base.endsWith("/") ? base : `${base}/`;
  const prefix = locale === "en" ? "" : `${locale}/`;
  const clean = page.replace(/^\/+/u, "");
  const path = `${root}${prefix}${clean}`;
  return path.endsWith("/") ? path : `${path}/`;
}
