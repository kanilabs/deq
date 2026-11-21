---
title: Inkscape
description: Şiklên Deqê bi qatên wan di Inkscape de veke, rengê wan biguherîne, xetê biguherîne û pêkhatinan ava bike.
sidebar:
  order: 1
---

> Ev nivîs pêşnûmeyek e û hîn divê axêverên kurmancî lê binêrin. Rastkirin di [lîsteya pirsgirêkan](https://github.com/kanilabs/deq/issues) de bi xêr hatin.

> Bi Inkscape 1.4.3 li ser Linux hatiye ceribandin. Navên menuyan wek rûkara îngilîzî ya Inkscape 1.4 ne; kurteriyên klavyeyê Ctrl bi kar tînin, ku li ser Mac ⌘ ye.

Inkscape bi SVG dixebite, formata bingehîn a Deqê, ji ber vê yekê her tiştî diparêze: qat, serên gilover û koordînatên rast.

## Wergirtina pelan

- **Layered SVG** her parçeyek şiklê wek qateke Inkscape dihêle. Wê ji [Stûdyoyê](../guide/exporting.md) (formata `svg-layered`) an bi rêza fermanê derxe: `deq render kurdish-sun --layered --out kurdish-sun.svg`.
- Derxistinên **PDF** û **AI** heman qatan wek qatên PDF diparêzin.
- **SVG daxe** li ser rûpela îkonê SVGyeke hêsan bê qat dide, ku ji bo bikaranîna yek rengî baş e.

Heke tu dixwazî li ser torê ji nû ve xêz bikî, bi 24 px ya standard derxe: wê demê pîkselek yekîneyeke torê ye.

## Vekirin bi qatan

1. **File ‣ Open** (Ctrl+O) û Layered SVG hilbijêre.
2. **Layer ‣ Layers and Objects** (Ctrl+Shift+L) qatan bi nav rêz dike, bo nimûne `ring` û `rays` ji bo Roj bi tîrêjan. Bişkojkên çav û kilîtê bi kar bîne da ku qatekê veşêrî an kilît bikî.

**File ‣ Import** (Ctrl+I) li şûna wê pelekê dixe nav belgeya vekirî, di qata niha de. Dema ku qatan dixwazî Open bi kar bîne.

Ji bo pelên PDF an AI, vebijarka standard a anîna PDF bihêle ne **Poppler/Cairo import**: ya standard qatên PDF wek qatên Inkscape diparêze, Poppler/Cairo import naparêze.

## Guhertina rengan

1. Parçeyên ku dixwazî rengê wan biguherînî hilbijêre. Ji bo girtina qateke tevahî, di **Layers and Objects** de lê bitikîne û **Edit ‣ Select All** (Ctrl+A) hilbijêre.
2. **Object ‣ Fill and Stroke** (Ctrl+Shift+F) veke.
3. Xet: rengê li ser taba **Stroke paint** deyne. Xal giloverên dagirtî ne: wan li ser taba **Fill** deyne.

Şiklên Deqê `currentColor` bi kar tînin, ku Inkscape heta tu rengekî deynî wek reş nîşan dide. Ji bo derbaskirina vê gavê, bi rengên danîbûyî derxe: **Reng** û **Rengên qatan** di Stûdyoyê de, an `--color` û `--layer-color rays=#FEBD11` li ser rêza fermanê.

## Guhertina xetê

Li ser taba **Stroke style** ya **Fill and Stroke**, **Width**, **Cap** û **Join** biguherîne. Serên û girêkên gilover bihêle da ku bi şiklên din re li hev bê. Stûriya 2 li 24 px standarda Deqê ye; binêre [xet, xal û modul](../designer/strokes-and-dots.md).

Ji bo makîneyên birînê, neqşkirinê an 3D, **Path ‣ Stroke to Path** her xetê dike doreke dagirtî bi heman şiklî.

## Avakirina pêkhatinan

1. Torê vêxe: **File ‣ Document Properties** (Ctrl+Shift+D) mîhengên torê digire; ji bo şiklên 24 px navbera 1 px bi kar bîne. **View ‣ Page Grid** (#) wê nîşan dide an vedişêre.
2. Her şiklî bi **File ‣ Import** bîne, hemû bi heman mezinahiyê derxistî.
3. Şiklên tevahî biliviîne, mezinahiya wan neguherîne, û herî kêm 1 yekîneya torê di navbera mîrekeba cîranan de bihêle. **Object ‣ Align and Distribute** wan rêz dike.

Ji bo rêzikan binêre [navber û pêkhatin](../designer/composition.md), û ji bo koordînatên rast beşa [avakirinê](../designer/construction.md) ya her rûpela îkonê.

## Çavkanî

- Bi Inkscape 1.4.3 hatiye ceribandin: navên menuyan ji `menus.ui` ya wê, kurterê ji `keys/inkscape.xml` ya standard, û qatên pelên SVG û PDF ên qatdar ên Deqê piştî anînê.
- [Belgeyên Inkscape](https://inkscape.org/learn/)
