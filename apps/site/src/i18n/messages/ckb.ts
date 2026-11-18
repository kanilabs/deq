/**
 * Sorani (ckb, Arabic script, right to left) UI strings.
 * Status: AI-drafted, needs native review (ADR 0012, Q10).
 */
import type { Messages } from "./en.ts";

export const ckb = {
  "site.title": "دەق",
  "site.tagline": "نەخشی دەقی کوردیی کۆن وەک سیستەمێکی دیزاینی کراوە و پارامەتری.",
  "site.description":
    "دەق نەخشەکانی دەقی کوردیی کۆن دەکاتە ئایکۆن، فۆنت و ئامرازی کراوە، لەگەڵ چیرۆکێکی کولتووریی بە سەرچاوە.",

  "nav.home": "سەرەتا",
  "nav.icons": "ئایکۆنەکان",
  "nav.flag": "ئاڵا",
  "nav.fonts": "فۆنتەکان",
  "nav.brand": "براند",
  "nav.about": "دەربارە",
  "nav.docs": "بەڵگەنامەکان",
  "nav.explore": "گەڕان",

  "review.notice":
    "ئەم وەرگێڕانە بە یارمەتیی AI نووسراوە و پێویستی بە پێداچوونەوەی کەسێکی زمانزان هەیە.",
  "review.badge": "پێویستی بە پێداچوونەوە هەیە",

  "home.title": "دەق: نەخشی دەقی کوردی وەک ئایکۆنی کراوە",
  "home.hero.title": "نەخشی دەقی کوردی، وەک سیستەمێکی دیزاینی کراوە کێشراوە",
  "home.hero.tagline":
    "{count} شێوە لەسەر یەک تۆڕی ٢٤ یەکەیی، بە هەمان شێوە لە TypeScript و Python و Rust دەکێشرێن، لەگەڵ پاکێجی ئایکۆن، فۆنت و ئامرازی هێڵی فەرمان.",
  "home.cta.icons": "سەیری ئایکۆنەکان بکە",
  "home.cta.docs": "بەڵگەنامەکان بخوێنەوە",
  "home.quickstart.title": "دەستپێکی خێرا",
  "home.quickstart.body": "پاکێجێک دابمەزرێنە و شێوەیەک وەک SVG بکێشە.",
  "home.featured.title": "شێوە هەڵبژێردراوەکان",
  "home.explore.title": "گەڕان",
  "home.card.icons": "هەموو شێوەکان لەگەڵ ناو، پارامەتر و خاڵی کۆدیان.",
  "home.card.flag": "ئاڵای کوردستان، لەسەر بنەمای وەسفە بڵاوکراوەکەی کێشراوە.",
  "home.card.fonts": "فۆنتی ئایکۆنی جێگیر، گۆڕاو و ڕەنگاوڕەنگ.",
  "home.card.brand": "نیشانەی دەق، ڕەنگەکان و یاساکانی بەکارهێنان.",
  "home.card.docs": "پاکێجەکان، ئامرازی هێڵی فەرمان، وەشانەکان و شێوازی شێوەکان.",
  "home.card.about": "پرۆژەکە، نووسەر، مۆڵەت و چۆنیەتیی بەشداریکردن.",

  "icons.title": "ئایکۆنەکان",
  "icons.description":
    "هەموو {count} شێوەی دەق، بە پێی پۆل. هەموو ئایکۆنێک بە مۆڵەتی GPL بەخۆڕاییە.",
  "icons.search.label": "پاڵاوتنی ئایکۆنەکان",
  "icons.search.placeholder": "ناو، تاگ یان ناوی تر",
  "icons.category.label": "پۆل",
  "icons.category.all": "هەموو پۆلەکان",
  "icons.results": "{count} لە {total} شێوە",
  "icons.empty": "هیچ شێوەیەک لەگەڵ ئەم پاڵاوتنە ناگونجێت.",
  "icons.noscript": "پاڵاوتن پێویستی بە JavaScript هەیە؛ هەموو شێوەکان لە خوارەوە دانراون.",

  "icon.title": "ئایکۆنی {name}",
  "icon.description":
    "نەخشی دەقی {name} ({category}): SVG، ناوەکان، پارامەترەکان و خاڵی کۆدی فۆنت.",
  "icon.back": "هەموو ئایکۆنەکان",
  "icon.preview": "پێشبینین",
  "icon.details": "وردەکاری",
  "icon.category": "پۆل",
  "icon.id": "ناسنامە",
  "icon.tags": "تاگەکان",
  "icon.aliases": "ناوەکانی تر",
  "icon.layers": "چینەکان",
  "icon.symmetry": "هاوسەنگی",
  "icon.parameters": "پارامەترەکان",
  "icon.parameter.default": "بنەڕەت {value}",
  "icon.codepoint": "خاڵی کۆدی فۆنت",
  "icon.names": "ناوەکان",
  "icon.name.en": "ئینگلیزی",
  "icon.name.ckb": "سۆرانی",
  "icon.name.kmr": "کرمانجی",
  "icon.name.unknown": "هێشتا تۆمار نەکراوە",
  "icon.usage": "بەکارهێنان",
  "icon.download": "داگرتنی SVG",
  "icon.none": "هیچ",
  "icon.prev": "شێوەی پێشوو",
  "icon.next": "شێوەی دواتر",

  "category.celestial": "ئاسمانی",
  "category.nature": "سروشت",
  "category.geometric": "ئەندازەیی",
  "category.dots": "خاڵەکان",
  "category.lines-and-borders": "هێڵ و چوارچێوە",
  "category.human-and-animal": "مرۆڤ و ئاژەڵ",
  "category.compositions": "پێکهاتەکان",
  "category.kurdish-symbols": "هێما کوردییەکان",

  "flag.title": "ئاڵای کوردستان",
  "flag.description":
    "ئاڵای کوردستان لەسەر بنەمای وەسفەکەی: سێ بەشی یەکسان و خۆرێک بە ٢١ تیشک، لە هەموو جۆرە پەسەندکراوەکاندا.",
  "flag.intro":
    "بەشی سوور، سپی و سەوز بە بەرزیی یەکسان، لەگەڵ خۆرێکی زەرد بە ٢١ تیشک لە ناوەڕاست. ڕێژەکە ٣:٢یە، یەکەم تیشک ڕووی لە سەرەوەیە، و خۆرەکە نیوەی بەرزیی ئاڵاکەیە.",
  "flag.colors": "ڕەنگەکان",
  "flag.variants": "جۆرەکان",
  "flag.variant.full-color": "ڕەنگی تەواو",
  "flag.variant.mono-black": "یەک ڕەنگی ڕەش",
  "flag.variant.mono-white": "یەک ڕەنگی سپی",
  "flag.variant.outline": "هێڵی دەرەوە",
  "flag.variant.high-contrast": "جیاوازیی بەرز",
  "flag.variant.square": "چوارگۆشە",
  "flag.color.red": "سوور",
  "flag.color.white": "سپی",
  "flag.color.green": "سەوز",
  "flag.color.yellow": "زەرد",
  "flag.contrast":
    "هیچ جووتێک لە ڕەنگەکانی ئاڵا ناگاتە جیاوازیی ٤.٥:١ کە بۆ دەقی ئاسایی پێویستە. دەقی ڕەش یان سپی لەسەر ڕەنگەکانی ئاڵا بەکاربهێنە.",
  "flag.rules": "هەرگیز ڕەنگی ئاڵاکە مەگۆڕە، مەیکێشە و ژمارەی تیشکەکانی مەگۆڕە.",

  "fonts.title": "فۆنتەکان",
  "fonts.description":
    "فۆنتەکانی ئایکۆنی دەق: فۆنتێکی جێگیر، فۆنتێکی گۆڕاو بە تەوەری قورسی و خاڵ، و فۆنتێکی ڕەنگاوڕەنگ.",
  "fonts.intro":
    "هەر شێوەیەک خاڵی کۆدێکی جێگیری هەیە لە ناوچەی بەکارهێنانی تایبەت، لە U+E000 دەست پێدەکات. خاڵەکانی کۆد هەرگیز ناگۆڕدرێن و دووبارە بەکارناهێنرێنەوە.",
  "fonts.static": "جێگیر",
  "fonts.static.body": "یەک قورسی، وەک OTF، TTF و WOFF2.",
  "fonts.variable": "گۆڕاو",
  "fonts.variable.body": "تەوەرێکی قورسی (wght) و تەوەرێکی قەبارەی خاڵ (DOTS).",
  "fonts.color": "ڕەنگاوڕەنگ",
  "fonts.color.body": "COLRv1 لەگەڵ OT-SVG وەک یەدەگ، بە ڕەنگەکانی ئاڵا.",
  "fonts.specimen": "نموونە",
  "fonts.weight": "قورسی",
  "fonts.install": "دامەزراندن",
  "fonts.install.body":
    "CSS و نەخشەی خاڵەکانی کۆد لە پاکێجی ئایکۆنەکان بەکاربهێنە، یان فایلەکانی فۆنت لەسەر سیستەمەکەت دابمەزرێنە.",

  "brand.title": "براند",
  "brand.description": "نیشانەی دەق، ڕەنگەکانی و یاساکانی بەکارهێنانی ئاڵا و خۆری کوردی.",
  "brand.logo": "نیشانە",
  "brand.logo.body":
    "نیشانەی دەق نیشانەی چەناگەیە: V ێک بە ڕووی خوارەوە و خاڵێک لە سەرییەوە، لەسەر هەمان تۆڕی هەموو شێوەکان کێشراوە. هێشتا وشەنیشانە نییە.",
  "brand.colors": "ڕەنگەکان",
  "brand.rules": "یاساکان",
  "brand.rule.contrast": "دەق و واتا دەبێت جیاوازیی WCAG AA بەدەست بهێنن.",
  "brand.rule.flag": "تەنها ئەو جۆرانەی ئاڵا بەکاربهێنە کە لە پەڕەی ئاڵادا هاتوون.",
  "brand.rule.yellow": "هەرگیز زەرد لەسەر سپی یان سوور لەسەر سەوز بۆ گەیاندنی واتا بەکارمەهێنە.",

  "about.title": "دەربارە",
  "about.description": "کێ دەق دروست دەکات، بە کام مۆڵەت، و چۆن بەشداری بکەیت.",
  "about.project": "پرۆژەکە",
  "about.project.body":
    "دەق نەخشەکانی دەقی کوردیی کۆن لە سەرچاوە بڵاوکراوەکانەوە کۆدەکاتەوە و وەک سیستەمێکی دیزاینی پارامەتری دووبارە دەیانکێشێتەوە. هەموو وتەیەک دەربارەی واتای نەخشێک سەرچاوەی هەیە.",
  "about.author": "نووسەر",
  "about.license": "مۆڵەت",
  "about.license.body":
    "کۆد و شێوەکان بە مۆڵەتی GPL-3.0-or-later بڵاوکراونەتەوە. فۆنتەکان GPL لەگەڵ هەڵاوێردنی فۆنت بەکاردەهێنن، بۆیە ئەو بەڵگەنامانەی تێیاندا جێگیر دەکرێن کاریگەر نابن.",
  "about.contribute": "بەشداری بکە",
  "about.contribute.body":
    "ڕاستکردنەوەی ناو، وەرگێڕان و سەرچاوەکان بەخێربێن. لە GitHub کێشەیەک یان داواکاریی گۆڕانکاری بکەرەوە.",
  "about.translations": "وەرگێڕانەکان",
  "about.translations.body":
    "دەقە سۆرانی و کرمانجییەکانی ئەم ماڵپەڕە بە یارمەتیی AI نووسراون و چاوەڕێی پێداچوونەوەی زمانزانانن.",
  "about.source": "کۆدی سەرچاوە لە GitHub",

  "notFound.title": "پەڕەکە نەدۆزرایەوە",
  "notFound.body": "ئەم پەڕەیە بوونی نییە. لەوانەیە گوازرابێتەوە، یان ناونیشانەکە هەڵە بێت.",
  "notFound.home": "بڕۆ بۆ پەڕەی سەرەتا",

  "pwa.update": "وەشانێکی نوێی ئەم ماڵپەڕە بەردەستە.",
  "pwa.reload": "دووبارە بارکردنەوە",
  "pwa.dismiss": "دواتر",
} as const satisfies Messages;
