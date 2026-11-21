---
title: Tor û xetên sereke
description: Kanvasa 24 yekîneyî, qada zindî û pênc xetên sereke yên ku her şiklê Deqê li ser wan tê xêzkirin.
sidebar:
  order: 1
---

> Ev nivîs pêşnûmeyek e û hîn divê axêverên kurmancî lê binêrin. Rastkirin di [lîsteya pirsgirêkan](https://github.com/kanilabs/deq/issues) de bi xêr hatin.

Her şiklê Deqê li ser heman kanvasa çargoşe tê xêzkirin, ji ber vê yekê her du şikl li hev rast tên û li kêleka hev heman giranî xuya dikin. Nirxên vê rûpelê ji [`spec/grid.json`](../../../spec/grid.json) tên, ew pela ku renderer, font û lint dixwînin.

## Kanvas

- **24 × 24 yekîne**, destpêk li quncika jor a çepê, y ber bi jêr. Dema şiklek bi 24 px tê nîşandan, yekîneyek yek pîksel e.
- **Valahiya 1**, ji ber vê yekê **qada zindî** çargoşeya 22 × 22 e ji (1, 1) heta (23, 23). Tu mîrekeb jê dernakeve, keviyên xetan jî.
- Koordînat **herî zêde 3 reqemên piştî xalê** hene.
- Navenda kanvasê (12, 12) e.

Ji ber ku xeta standard 2 yekîne fireh e, nîvê wê (1 yekîne) dikeve derveyî xeta navendê. Ji ber vê yekê xetên navendê li ser her du eksenan di navbera 2 û 22 de dimînin.

## Xetên sereke

Xetên sereke şiklên rêberiyê ne. Her şikl li gorî xeta sereke ya ku dişibe dora wî tê danîn, ji ber vê yekê şiklekî gilover û şiklekî çargoşe heman mezinahî xuya dikin, her çend qutiyên wan cuda bin jî.

| Xeta sereke | Geometrî                       | Ji bo                                           |
| ----------- | ------------------------------ | ----------------------------------------------- |
| Gilover     | navend (12, 12), r 10          | Şiklên gilover: roj, gulok, xelek               |
| Çargoşe     | 18 × 18 li (3, 3)              | Şiklên çargoşe, da ku bi giloverê re li hev bên |
| Stûnî       | 16 fireh × 20 bilind li (4, 2) | Şiklên dirêj: qurm, fîgur                       |
| Asoyî       | 20 fireh × 16 bilind li (2, 4) | Şiklên fireh: rêz, bend, heywan                 |
| Qada zindî  | 22 × 22 li (1, 1)              | Sînorê derve yê mîrekebê, qet ne armanc e       |

Xeta sereke ya çargoşe ji qutiya 20 × 20 ya giloverê piçûktir e, ji ber ku çargoşeyek bi heman firehiyê rûberekî mezintir digire û girantir xuya dike. Bo nimûne, [`x-mark`](https://kanilabs.github.io/deq/kmr/icons/x-mark/) xetên xwe yên xwar ji (5, 5) heta (19, 19) dikişîne, ji ber vê yekê bi serên gilover qutiya wê ya dîtbar li ser her du eksenan ji 4 heta 20 ye, di nav xeta sereke ya çargoşe de (3 heta 21).

## Dîtina torê

- Her rûpela îkonê ya malperê beşeke **Avakirin** heye: tor, xetên sereke û qada zindî li pişt şiklê hatine xêzkirin, û xal li ser navendên gilover, kevan, stêrk û dubarekirinan in. Binêre [Roja Kurdî](https://kanilabs.github.io/deq/kmr/icons/kurdish-sun/#construction).
- Di [Stûdyoyê](../guide/studio.md) de, **Tor** (G) û **Xetên sereke** (K) di darikê amûran de heman rêberan li ser kanvasê nîşan didin, û **Pêvegirtin** (S) şiklan bi torê ve girê dide.
- Ji bo xêzên xwe, [rêberên amûran](../tools/inkscape.md) rave dikin ka di her bernameyê de çawa torek 24 yekîneyî saz bikî.

## Paşê

- [Xet, xal û modul](strokes-and-dots.md): parçeyên ku her şikl ji wan tê avakirin.
- [Rastkirinên dîtinî](optical-corrections.md): çima hin navend ne rast li ser 12, 12 ne.
