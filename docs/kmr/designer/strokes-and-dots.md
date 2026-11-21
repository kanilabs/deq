---
title: Xet, xal û modul
description: Stûriya xetê, serên xetê, mezinahiya xalan û çend parçeyên ji nû ve bikaranîbar ên ku her şiklê Deqê ji wan tê avakirin.
sidebar:
  order: 2
---

> Ev nivîs pêşnûmeyek e û hîn divê axêverên kurmancî lê binêrin. Rastkirin di [lîsteya pirsgirêkan](https://github.com/kanilabs/deq/issues) de bi xêr hatin.

Şiklên Deqê xêzên xetî ne, wek wan deqan ku ji wan tên. Çend rêzikên kêm her xet û xalê wek hev digirin, ji ber vê yekê şikl dikarin li kêleka hev rûnin, bi hev re bên berhevkirin û parçeyên xwe parve bikin.

## Xet

- **Stûriya 2 yekîne.** Li 24 px ev 2 px e; li 48 px, 4 px. Xet bi şiklê re mezin dibe, heke tu stûriyeke mutleq nexwazî (li jêr binêre).
- **Serên gilover û girêkên gilover.** Ji ber vê yekê xetek 1 yekîne ji xalên xwe yên dawiyê derbas dibe, û quncik gilover in.
- **Bê dagirtin, mîrekeba `currentColor`.** Xetek rengê nivîsa derdora xwe digire, heke tu rengekî danenî.
- **3 yekîne di navbera xetên navendê yên paralel de.** Bi xeteke 2 yekîneyî, 1 yekîne valahiya vala di navbera xetan de dimîne. Ji bo xetên xwar, li ser xetê bi goşeya rast bipîve, ne li ser eksenekê.

### Guhertina xetê

Hemû renderer, Stûdyo û pêkhateyên îkonan heman vebijarkan qebûl dikin:

| Vebijark              | Standard | Çi dike                                               |
| --------------------- | -------- | ----------------------------------------------------- |
| `strokeWidth`         | 2        | Stûriya xetê bi yekîneyên torê                        |
| `absoluteStrokeWidth` | false    | Xetê di her mezinahiyê de `strokeWidth` pîksel digire |
| `linecap`             | `round`  | `round`, `butt` an `square`                           |
| `linejoin`            | `round`  | `round`, `miter` an `bevel`                           |
| `strokeOpacity`       | 1        | Nezelaliya xet û xalan                                |

Xeteke ziravtir (1.5 an 1) ji bo mezinahiyên mezin û pêkhatinên tîr baş e. Li 24 px û jêrtir 2 bihêle, ku li wir xetên ziravtir şêlû dibin. Bi `absoluteStrokeWidth`, îkonek 48 px xeta 2 px diparêze li şûna ku bibe 4 px, ku li kêleka nivîsê bi kêr tê. Lîsteya tevahî di [referansa API ya core](../../api/core.md) de ye.

## Xal

- **Xal giloverên dagirtî ne**, ne xet. Di nav şiklan de **nîvtîreya wan 1** e, ji ber vê yekê xalek bi qasî xetekê fireh e.
- **Xala mezin** nîvtîreya 2 heye. Şiklê serbixwe [`dot`](https://kanilabs.github.io/deq/kmr/icons/dot/) wê bi kar tîne da ku di mezinahiyên piçûk de jî bê xwendin.
- `dotScale` nîvtîreya hemû xalan zêde dike, bo nimûne 1.5 ji bo xalên girantir di mezinahiyên mezin de.

## Modul

Her şikl ji heman parçeyan tê avakirin, ku di bin `modules` de di [`spec/grid.json`](../../../spec/grid.json) de hatine rêzkirin. Lint her nîvtîreyeke din a gilover an xalê red dike.

| Modul         | Mezinahî                                    | Nimûne                                                                           |
| ------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| Giloverê rojê | r 5                                         | [Giloverê rojê](https://kanilabs.github.io/deq/kmr/icons/roj-sun-circle/)        |
| Xelek         | r 3                                         | [Roj bi tîrêjan](https://kanilabs.github.io/deq/kmr/icons/sun-rays/)             |
| Morî          | r 2 (xetkirî)                               | [Zincîr](https://kanilabs.github.io/deq/kmr/icons/chain/)                        |
| Xal           | r 1 (piçûk), r 2 (mezin)                    | [Guloka xalan](https://kanilabs.github.io/deq/kmr/icons/dot-rosette/)            |
| Tîrêj         | 2.5 piştî giloverê dest pê dikin, 2.5 dirêj | [Nîv roj](https://kanilabs.github.io/deq/kmr/icons/roj-half-sun/): r 7.5 heta 10 |
| V             | du xet bi 45°, 3 × 3 an 6 × 6               | –                                                                                |
| Gava 45°      | xetên paralel ên 45° bi dûriya 4.5          | [Stûna V-yan](https://kanilabs.github.io/deq/kmr/icons/chevron-stack/)           |
| Diran, nîşan  | 3 dirêj, her 3 yekîneyan                    | [Şe](https://kanilabs.github.io/deq/kmr/icons/comb/)                             |

Çima 4.5 ji bo gava 45°: du xetên 45° ku li ser eksenekê 4.5 ji hev dûr in, bi goşeya rast li ser xetan 4.5 × sin 45° ≈ 3.18 ji hev dûr in, hinekî ji kêmtirîn 3 yekîneyan zêdetir.

V her tim du xetên cuda ne ji serekî hevpar, qet ne yek polîxet e, ji ber vê yekê her milek bi serê xwe dikare bê nîşandan, veşartin an rengguhertin.

## Qat

Her parçeyek şiklê qata xwe ye (`sun`, `rays`, `dot`, ...), û derxistinên qatdar wan ji hev cuda dihêlin: qatên Inkscape di Layered SVG de, qatên PDF di PDF û AI de, qatên pîkselan di PSD de. Rûpela îkonê qatên şiklekî rêz dike, û `layerColors` rengekî cuda dide her qatê. Binêre [Derxistin](../guide/exporting.md).

## Paşê

- [Rastkirinên dîtinî](optical-corrections.md)
- [Xwendina avakirinekê](construction.md)
