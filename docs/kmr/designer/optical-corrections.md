---
title: Rastkirinên dîtinî
description: Şiklên Deqê çawa hinekî tên livandin da ku navendî û bi giraniyeke wekhev xuya bikin, bi matematîka her rewşê.
sidebar:
  order: 3
---

> Ev nivîs pêşnûmeyek e û hîn divê axêverên kurmancî lê binêrin. Rastkirin di [lîsteya pirsgirêkan](https://github.com/kanilabs/deq/issues) de bi xêr hatin.

Şiklek dikare bi hejmaran navendî be û dîsa jî xwar xuya bike. Deq vê yekê bi çend awayên sabît rast dike, û her rastkirinê di gavên `construction` ên şiklê de tomar dike, ji ber vê yekê sedema her hejmareke ecêb hatiye nivîsandin.

## Mîrekebê navendî bike, ne geometriyê

Her şikl li gorî **qutiya xwe ya dîtbar** navendî dibe: qutiya li dora mîrekebê, bi xet û serên gilover ve. Qutiya dîtbar li ser (12, 12) navendî dibe li ser her eksena ku sîmetriya şiklê azad dihêle, bi nêzîkkirina 0.5. `visualBox` di pîvanên her şiklî de (li ser rûpela wê ya îkonê tê nîşandan) dihêle tu wê kontrol bikî. Lint bi xwe sîmetriyê kontrol dike, û ku her hevgirtina parametreyan di nav qada zindî de dimîne.

Ji ber vê yekê şiklên nesîmetrîk bi tevahî tên livandin. [Heyva nû](https://kanilabs.github.io/deq/kmr/icons/heyv-crescent/) ji du giloveran tê avakirin:

- keviya derve: r 9 li dora (10, 12);
- keviya hundir: r 7.5 li dora (5.5, 12), 4.5 ber bi çepê.

Gilover li cihê ku (x − 10)² − (x − 5.5)² = 9² − 7.5² hev dibirin, ku x = 5 û y = 12 ± √(81 − 25) = 12 ± 7.483 dide. Mîrekeb ji qiloçan li x = 5 − 1 = 4 heta keviya derve li 10 + 9 + 1 = 20 dirêj dibe, ji ber vê yekê navenda wê (4 + 20) / 2 = 12 e. Navendên giloveran li çepê 12 ne da ku heyv wek tê dîtin navendî be.

## Stêrkê li xeta sereke bîne

Stêrkek bi hejmareke kit a seran li jor navenda xwe bilindtir e ji jêr. [Roja Kurdî](https://kanilabs.github.io/deq/kmr/icons/kurdish-sun/#construction) 21 ser hene û ya yekem rast ber bi jor e:

- Sera jor R li jor navendê ye.
- Serên herî nizm ew du ne ku li her du aliyên jêr in, R cos(π/21) li jêr navendê.
- Ji ber vê yekê bilindahî R (1 + cos(π/21)) e. Danîna wê li ser xeta sereke ya 20 yekîneyî R = 20 / (1 + cos(π/21)) = 10.0562 dide.
- Ji bo navendîkirina qutiya 2 heta 22, navenda stêrkê dadikeve (12, 12.056).

Ala Kurdistanê jî bi pîvana xwe heman tiştî dike: navenda roja wê li y = 300.842 ye li ser zemîneke 600 yekîne bilind. [Rêbera alayê](../guide/flag.md) hejmaran dide.

## Dor ji heman keviyê

Dema şiklekî dagirtî guhertoyeke xetkirî jî hebe, xet 1 yekîne ber bi hundir tê xêzkirin, ji ber vê yekê keviya derve ya xeta 2 yekîneyî dikeve cihê ku keviya dagirtî lê bû. Dora Roja Kurdî R − 1 = 9.056 û nîvtîreya hundir 4.528 bi kar tîne. Bi vî awayî guhertoyên dagirtî û xetkirî heman mezinahî hene.

## Şiklên çargoşe piçûktir in

Çargoşeyek bi qasî firehiya giloverekê mezintir xuya dike, ji ber ku rûberekî zêdetir digire. Ji ber vê yekê şiklên çargoşe xeta sereke ya çargoşe ya 18 × 18 bi kar tînin li şûna qutiya 20 × 20 ya giloverê. Binêre [tor û xetên sereke](grid.md).

## Navber bi goşeya rast li ser xetê tê pîvandin

Valahiya di navbera xetan de bi goşeya rast li ser wan tê pîvandin. Ji bo xetên xwar, valahiya li ser eksenekê ji valahiya rastîn mezintir e:

- Xetên paralel ên 45° her 4.5 yekîneyan dubare dibin, ku bi goşeya rast li ser xetan 3.18 e.
- [Lozenga hundirîn](https://kanilabs.github.io/deq/kmr/icons/lozenge-nested/) dora xwe bi pîvanên 1 û 0.5 kopî dike. Her kevî 72 / √145 = 5.98 ji navendê dûr e, ji ber vê yekê kopî bi goşeya rast li ser keviyan 2.99 ji hev dûr in, nêzîkî 1 yekîne valahî. Gaveke 1/3 dê xetan pir nêzîkî hev bike, û kopiyeke sêyemîn cih nagire.

## Xaleke mezintir dema bi tenê ye

Xalên di nav şiklan de nîvtîreya 1 hene, bi qasî xetekê fireh. Şiklê serbixwe [`dot`](https://kanilabs.github.io/deq/kmr/icons/dot/) nîvtîreya 2 bi kar tîne, da ku li 16 px winda nebe.

## Paşê

- [Xwendina avakirinekê](construction.md)
- [Navber û pêkhatin](composition.md)
