/** Shared helpers for the site's own pages (rendered with Starlight's `StarlightPage`). */
import { localeFromParam, useTranslations, type Locale } from "../i18n/index.ts";

/** Locale, translator and props for a `[...locale]` page. */
export function pageContext(param: string | undefined): {
  locale: Locale;
  t: ReturnType<typeof useTranslations>;
} {
  const locale = localeFromParam(param);
  return { locale, t: useTranslations(locale) };
}
