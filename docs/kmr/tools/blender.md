---
title: Blender
description: Şiklên Deqê wek kevan an xetên Grease Pencil bîne nav Blender û kûrahiyê bide wan ji bo 3D.
sidebar:
  order: 8
---

> Ev nivîs pêşnûmeyek e û hîn divê axêverên kurmancî lê binêrin. Rastkirin di [lîsteya pirsgirêkan](https://github.com/kanilabs/deq/issues) de bi xêr hatin.

> Li ser rêbernameya Blender hatiye nivîsandin, ku li jêr hatiye girêdan; li vir nehatiye ceribandin. Navên menuyan wek rûkara îngilîzî ne.

Blender tenê geometriya rêçên SVG dixwîne. Xet, dagirtin û reng tên paşguhkirin, ji ber vê yekê şiklekî Deqê wek xetên xwe yên navendê tê. Di Blender de stûriyê bide wan, an berê xetan bike dor.

## Wergirtina pelan

- **SVG daxe** li ser rûpela îkonê, an `svg` ji [Stûdyoyê](../guide/exporting.md), ji bo xetên navendê.
- Ji bo dorên ku xetê rast diparêzin, SVGyê di [Inkscape](inkscape.md) de veke, hemûyan hilbijêre, **Path ‣ Stroke to Path** bi kar bîne û tomar bike. Her xet dibe doreke dagirtî ku Blender wek kevaneke girtî tîne.

## Anîn wek kevan

1. **File ‣ Import ‣ SVG as Curves** (Scalable Vector Graphics).
2. Kevan di rûxara XY de tên çêkirin û bi yekîneyên SVGyê tên pîvandin, ji ber vê yekê şiklekî 24 px piçûk e: di viewportê de mezin bike.

Rêbername dibêje anîner tenê geometriya rêçên SVG piştgirî dike û gradient, dagirtin, xet, nivîs, wêne û fîlteran paşguh dike. Şiklên Deqê gilover, xet û hêmanên din jî bi kar tînin; **Stroke to Path** di Inkscape de hemûyan dike rêç, ku riya herî ewle ye.

## Kûrahî dayîn

Kevanê hilbijêre û taybetmendiyên **Object Data**, panela **Geometry** veke:

- **Depth** di bin **Bevel** de mezinahiya birrîna gilover diyar dike, ku xetên navendê dike boriyan, nêzîkî xeteke Deqê.
- **Extrude** dorên girtî (ji Stroke to Path) derdixe şiklên hişk ji bo çapkirina 3D an rolyefê.

## Anîn wek Grease Pencil

**File ‣ Import ‣ SVG as Grease Pencil** li şûna wê xetên 2D çêdike. Vebijarkên wê **Resolution**, **Scale**, **Scene Unit** û **Center on Bounds** in.

## Guhertina rengan

Reng nayên anîn. Materyalekê li kevanê zêde bike û rengê li wir deyne.

## Çavkanî

- [Import SVG as curves](https://docs.blender.org/manual/en/latest/files/import_export/svg_curve.html)
- [Import SVG as Grease Pencil](https://docs.blender.org/manual/en/latest/files/import_export/grease_pencil_svg.html)
- [Curve geometry](https://docs.blender.org/manual/en/latest/modeling/curves/properties/geometry.html)
