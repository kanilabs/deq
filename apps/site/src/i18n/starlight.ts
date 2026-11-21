/**
 * Starlight's own UI strings for the locales Starlight does not ship (ckb, kmr).
 * Loaded by the `i18n` content collection in `src/content.config.ts`.
 * Status: AI-drafted, needs native review (ADR 0012, Q10).
 */

/** The Starlight UI keys this site translates (Starlight's English file). */
export type StarlightStrings = Readonly<
  Record<
    | "skipLink.label"
    | "search.label"
    | "search.ctrlKey"
    | "search.cancelLabel"
    | "search.devWarning"
    | "themeSelect.accessibleLabel"
    | "themeSelect.dark"
    | "themeSelect.light"
    | "themeSelect.auto"
    | "languageSelect.accessibleLabel"
    | "menuButton.accessibleLabel"
    | "sidebarNav.accessibleLabel"
    | "tableOfContents.onThisPage"
    | "tableOfContents.overview"
    | "i18n.untranslatedContent"
    | "page.editLink"
    | "page.lastUpdated"
    | "page.previousLink"
    | "page.nextLink"
    | "page.draft"
    | "404.text"
    | "aside.note"
    | "aside.tip"
    | "aside.caution"
    | "aside.danger"
    | "fileTree.directory"
    | "builtWithStarlight.label"
    | "heading.anchorLabel",
    string
  >
>;

export const starlightStrings: Readonly<Record<"ckb" | "kmr", StarlightStrings>> = {
  ckb: {
    "skipLink.label": "بازدان بۆ ناوەڕۆک",
    "search.label": "گەڕان",
    "search.ctrlKey": "Ctrl",
    "search.cancelLabel": "هەڵوەشاندنەوە",
    "search.devWarning": "گەڕان تەنها لە وەشانی بنیاتنراودا بەردەستە.",
    "themeSelect.accessibleLabel": "هەڵبژاردنی ڕووکار",
    "themeSelect.dark": "تاریک",
    "themeSelect.light": "ڕووناک",
    "themeSelect.auto": "سیستەم",
    "languageSelect.accessibleLabel": "هەڵبژاردنی زمان",
    "menuButton.accessibleLabel": "لیست",
    "sidebarNav.accessibleLabel": "سەرەکی",
    "tableOfContents.onThisPage": "لەم پەڕەیەدا",
    "tableOfContents.overview": "پوختە",
    "i18n.untranslatedContent": "ئەم ناوەڕۆکە هێشتا بە زمانەکەت بەردەست نییە.",
    "page.editLink": "دەستکاریکردنی پەڕە",
    "page.lastUpdated": "دوایین نوێکردنەوە:",
    "page.previousLink": "پێشوو",
    "page.nextLink": "دواتر",
    "page.draft": "ئەم ناوەڕۆکە ڕەشنووسە و لە وەشانی بڵاوکراوەدا نابێت.",
    "404.text": "پەڕەکە نەدۆزرایەوە. ناونیشانەکە بپشکنە یان گەڕان بەکاربهێنە.",
    "aside.note": "تێبینی",
    "aside.tip": "ئامۆژگاری",
    "aside.caution": "ئاگاداری",
    "aside.danger": "مەترسی",
    "fileTree.directory": "بوخچە",
    "builtWithStarlight.label": "بە Starlight دروستکراوە",
    "heading.anchorLabel": "بەشی «{{title}}»",
  },
  kmr: {
    "skipLink.label": "Biçe naverokê",
    "search.label": "Lêgerîn",
    "search.ctrlKey": "Ctrl",
    "search.cancelLabel": "Betal bike",
    "search.devWarning": "Lêgerîn tenê di guhertoya avakirî de heye.",
    "themeSelect.accessibleLabel": "Rûkarê hilbijêre",
    "themeSelect.dark": "Tarî",
    "themeSelect.light": "Ronî",
    "themeSelect.auto": "Pergal",
    "languageSelect.accessibleLabel": "Ziman hilbijêre",
    "menuButton.accessibleLabel": "Menû",
    "sidebarNav.accessibleLabel": "Sereke",
    "tableOfContents.onThisPage": "Li ser vê rûpelê",
    "tableOfContents.overview": "Kurte",
    "i18n.untranslatedContent": "Ev naverok hêj bi zimanê te tune.",
    "page.editLink": "Rûpelê biguherîne",
    "page.lastUpdated": "Nûkirina dawî:",
    "page.previousLink": "Berê",
    "page.nextLink": "Pêş",
    "page.draft": "Ev naverok reşnivîs e û di guhertoya weşandî de nabe.",
    "404.text": "Rûpel nehat dîtin. Navnîşanê kontrol bike an lêgerînê bi kar bîne.",
    "aside.note": "Nîşe",
    "aside.tip": "Şîret",
    "aside.caution": "Hişyarî",
    "aside.danger": "Xeterî",
    "fileTree.directory": "Peldank",
    "builtWithStarlight.label": "Bi Starlight hatiye çêkirin",
    "heading.anchorLabel": "Beşa “{{title}}”",
  },
};
