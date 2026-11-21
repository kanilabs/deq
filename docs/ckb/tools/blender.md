---
title: Blender
description: شێوەکانی دەق وەک کەوانە یان هێڵی Grease Pencil بهێنە ناو Blender و قووڵاییان پێبدە بۆ سێ ڕەهەندی.
sidebar:
  order: 8
---

> ئەم دەقە ڕەشنووسە و هێشتا پێویستی بە پێداچوونەوەی ئاخێوەرانی سۆرانی هەیە. ڕاستکردنەوەکان لە [لیستی کێشەکان](https://github.com/kanilabs/deq/issues) بەخێربێن.

> لەسەر بنەمای ڕێنمایی Blender نووسراوە، کە لە خوارەوە بەستراوە؛ لێرە تاقی نەکراوەتەوە. ناوی لیستەکان وەک ڕووکاری ئینگلیزین.

Blender تەنها ئەندازەی ڕێڕەوی SVG دەخوێنێتەوە. هێڵ، پڕکردنەوە و ڕەنگەکان پشتگوێ دەخرێن، بۆیە شێوەیەکی دەق وەک هێڵە ناوەڕاستەکانی دێت. لە Blender ئەستوورییان پێبدە، یان پێشتر هێڵەکان بکە بە دەور.

## وەرگرتنی فایلەکان

- **داگرتنی SVG** لە پەڕەی ئایکۆندا، یان `svg` لە [ستۆدیۆ](../guide/exporting.md)، بۆ هێڵە ناوەڕاستەکان.
- بۆ دەورێک کە هێڵەکە ڕێک بپارێزێت، SVG ـەکە لە [Inkscape](inkscape.md) بکەرەوە، هەمووی هەڵبژێرە، **Path ‣ Stroke to Path** بەکاربهێنە و پاشەکەوتی بکە. هەر هێڵێک دەبێتە دەورێکی پڕکراو کە Blender وەک کەوانەیەکی داخراو دەیهێنێت.

## هێنان وەک کەوانە

1. **File ‣ Import ‣ SVG as Curves** (Scalable Vector Graphics).
2. کەوانەکان لە ڕووتەختی XY دروست دەکرێن و بە یەکەکانی SVG ـەکە پێوانە دەکرێن، بۆیە شێوەیەکی ٢٤ پیکسڵ بچووکە: لە viewport گەورەی بکە.

ڕێنماییەکە دەڵێت هێنەرەکە تەنها ئەندازەی ڕێڕەوی SVG پشتگیری دەکات و gradient، پڕکردنەوە، هێڵ، دەق، وێنە و فلتەر پشتگوێ دەخات. شێوەکانی دەق بازنە، هێڵ و توخمی تریش بەکاردەهێنن؛ **Stroke to Path** لە Inkscape هەموویان دەکاتە ڕێڕەو، کە سەلامەتترین ڕێگایە.

## قووڵایی پێدان

کەوانەکە هەڵبژێرە و تایبەتمەندییەکانی **Object Data**، پانێڵی **Geometry** بکەرەوە:

- **Depth** لە ژێر **Bevel** قەبارەی بڕگە خڕەکە دیاری دەکات، کە هێڵە ناوەڕاستەکان دەکاتە بۆری، نزیک لە هێڵێکی دەق.
- **Extrude** دەورە داخراوەکان (لە Stroke to Path) دەردەهێنێت بۆ شێوەی پتەو بۆ چاپی سێ ڕەهەندی یان نەخشی بەرجەستە.

## هێنان وەک Grease Pencil

**File ‣ Import ‣ SVG as Grease Pencil** لە جیاتی ئەوە هێڵی دوو ڕەهەندی دروست دەکات. هەڵبژاردنەکانی **Resolution**، **Scale**، **Scene Unit** و **Center on Bounds**ی تێدایە.

## گۆڕینی ڕەنگ

ڕەنگەکان ناهێنرێن. ماددەیەک (material) بۆ کەوانەکە زیاد بکە و ڕەنگەکەی لەوێ دابنێ.

## سەرچاوەکان

- [Import SVG as curves](https://docs.blender.org/manual/en/latest/files/import_export/svg_curve.html)
- [Import SVG as Grease Pencil](https://docs.blender.org/manual/en/latest/files/import_export/grease_pencil_svg.html)
- [Curve geometry](https://docs.blender.org/manual/en/latest/modeling/curves/properties/geometry.html)
