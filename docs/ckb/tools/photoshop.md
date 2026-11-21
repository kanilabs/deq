---
title: Adobe Photoshop
description: شێوەکانی دەق لە Photoshop وەک فایلی PSD ـی چیندار یان Smart Object ـی گەورەکراو بەکاربهێنە، ڕەنگیان بگۆڕە و هێڵەکە بگۆڕە.
sidebar:
  order: 3
---

> ئەم دەقە ڕەشنووسە و هێشتا پێویستی بە پێداچوونەوەی ئاخێوەرانی سۆرانی هەیە. ڕاستکردنەوەکان لە [لیستی کێشەکان](https://github.com/kanilabs/deq/issues) بەخێربێن.

> لەسەر بنەمای بەڵگەنامەکانی Adobe نووسراوە، کە لە خوارەوە بەستراون؛ لێرە تاقی نەکراوەتەوە. ناوی لیستەکان وەک ڕووکاری ئینگلیزین.

Photoshop بە پیکسڵ کار دەکات، بۆیە فایلەکە بەپێی ئەوە هەڵبژێرە کە دواتر دەتەوێت چی بگۆڕیت.

## وەرگرتنی فایلەکان

- `psd` لە [ستۆدیۆ](../guide/exporting.md) یەک چینی پیکسڵی بۆ هەر چینێکی شێوەکە هەیە، بە هەر قەبارەیەک کە لە ژێر **قەبارەکان** هەڵیدەبژێریت (1× تا 4×).
- **PDF** شێوەکە وەک ڤێکتەر دەهێڵێتەوە. لە Photoshop دابنرێت دەبێتە Smart Object کە بە گەورەکردن لێڵ نابێت.
- **PNG** یەک وێنەی تەختە.

## کردنەوە

- **PSD**: **File ‣ Open**. هەر چینێکی دەق (بۆ نموونە `ring` و `rays`) چینی خۆیەتی لە پانێڵی Layers. کلیک لە ئایکۆنی چاو بکە بۆ پیشاندان یان شاردنەوەی یەکێکیان؛ Alt-click (لەسەر Mac Option-click) لەسەر چاوەکە تەنها ئەو چینە پیشان دەدات.
- **PDF**: **File ‣ Place Embedded** شێوەکە لە ناو بەڵگەنامەکەتدا وەک Smart Object هەڵدەگرێت؛ **File ‣ Place Linked** بەستەرێک بۆ فایلەکە دەهێڵێتەوە. Photoshop پێش دانانی PDF هەڵبژاردنەکانی بڕین دەپرسێت.

## گۆڕینی ڕەنگ

- لەسەر چینێکی پیکسڵ، **Lock transparent pixels** لە پانێڵی Layers چالاک بکە و چینەکە بە ڕەنگێکی نوێ پڕ بکەرەوە: تەنها پیکسڵە ڕەنگکراوەکان دەگۆڕێن.
- یان شێوازی چینی **Color Overlay** زیاد بکە، کە دواتر دەتوانیت دووبارە بیگۆڕیت.
- بۆ ڕەنگکردنی بەشەکان بە جیا، ڕەنگێکی جیا بە هەر چینێک بدە. دەتوانیت پێش هەناردن **ڕەنگی چینەکان** لە ستۆدیۆ دابنێیت.

## گۆڕینی هێڵ

هێڵی چینێکی پیکسڵ بێ دووبارە کێشانەوە ئەستوورتر یان باریکتر ناکرێت. لە ستۆدیۆ بە **ئەستووری هێڵ**ێکی جیاواز، یان لە هێڵی فەرمان بە `--stroke-width`، دووبارە هەناردە بکە و چینەکە بگۆڕەوە. قەبارەیەک هەڵبژێرە کە بۆ دیزاینی کۆتایی بەس گەورە بێت: چینی پیکسڵ بە گەورەکردن لێڵ دەبێت.

## دروستکردنی پێکهێنان

چینەکان لە نێوان بەڵگەنامەکاندا ڕابکێشە، یان چەند Smart Object ـی PDF دابنێ. شێوەکان بە هەمان قەبارە بهێڵەرەوە تا هێڵەکانیان وەک یەک بن، و بۆشایی لە نێوانیاندا بهێڵەرەوە. بڕوانە [بۆشایی و پێکهێنان](../designer/composition.md).

## سەرچاوەکان

- [Place files in Photoshop](https://helpx.adobe.com/photoshop/desktop/create-open-import-images/import-files/place-a-file-in-photoshop.html)
- [Place Illustrator and PDF files in Photoshop](https://helpx.adobe.com/photoshop/desktop/app-integrations/place-illustrator-files-or-pdf-in-photoshop.html)
- [Lock layers](https://helpx.adobe.com/photoshop/desktop/create-manage-layers/transform-manipulate-layers/lock-layers.html)
- [Fill selections or layers with colour](https://helpx.adobe.com/photoshop/desktop/apply-painting-techniques/fill-objects-selections-layers/fill-selection-layer-color.html)
