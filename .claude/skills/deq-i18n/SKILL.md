---
name: deq-i18n
description: Translation and right-to-left rules for Deq (English, Sorani ckb, Kurmanji kmr). Use when adding UI strings or content in any language.
---

# Deq i18n

- Locales: `en` (default, no URL prefix), `ckb` (Sorani, Arabic script, right-to-left, `/ckb/`), `kmr` (Kurmanji, Latin script, `/kmr/`). Locale data (`lang`, `dir`, label, review flag) is `LOCALE_INFO` in `apps/site/src/i18n/index.ts`.
- No hard-coded UI strings. Site strings live in `apps/site/src/i18n/messages/`: add the key to `en.ts` first (it defines `Messages` and `MessageKey`), then to `ckb.ts` and `kmr.ts`, which end with `as const satisfies Messages`, so a missing or extra key fails `astro check`. `test/i18n.test.ts` also checks non-empty values and that every `{placeholder}` of the English text is kept.
- Look strings up with `useTranslations(locale)` and `format`; numbers with `formatNumber` (Sorani uses Arabic-Indic digits). Links with `localizedPath(locale, page)`.
- Starlight's own UI strings for ckb and kmr are in `src/i18n/starlight.ts`; docs pages per locale in `src/content/docs/{ckb,kmr}/`.
- Use CSS logical properties (`inline-size`, `margin-inline-start`, `inset-inline-end`) so layouts mirror in RTL. Sorani text uses Vazirmatn first (`tokens.css`).
- AI-drafted translations are marked "needs native review" until a native speaker approves them: the banner on every ckb/kmr page, `needsReview` in `LOCALE_INFO`, and the `needs-native-review` status of shape names in `spec/`. Only a native reviewer changes a name to `verified`.
- Put Kurdish text that appears inside English pages (or the reverse) in an element with its own `lang` (and `dir="rtl"` for Sorani).
- Studio strings are the `studio.*` keys (plus `category.*`); `studioMessages(catalog)` passes only those to the island, and components translate with `translator(messages)`. Each shortcut action needs a `studio.action.<action>` key. Inspector arrange buttons reuse those labels; history labels are `studio.act.*`.
