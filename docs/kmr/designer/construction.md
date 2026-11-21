---
title: Xwendina avakirinekê
description: Beşa Avakirin li ser her rûpela îkonê çi nîşan dide, û çawa şiklê bi destan ji nû ve ava bikî.
sidebar:
  order: 4
---

> Ev nivîs pêşnûmeyek e û hîn divê axêverên kurmancî lê binêrin. Rastkirin di [lîsteya pirsgirêkan](https://github.com/kanilabs/deq/issues) de bi xêr hatin.

Her rûpela îkonê ya malperê beşeke **Avakirin** heye, ku ji pela şiklê di [`spec/shapes/`](../../../spec/shapes/) de tê avakirin. Ew her tiştê ku ji bo ji nû ve xêzkirina şiklê di her amûrê de û bi her mezinahiyê hewce dikî nîşan dide, bi heman hejmarên ku renderer bi kar tînin.

## Beş çi nîşan dide

- **Xêz.** Tora 24 yekîneyî bi xetên xwe yên navendê, xetên sereke (gilover, çargoşe, çarçoveyên stûnî û asoyî) û qada zindî bi xeta qutqutî, û şikl li ser wan. Xal navendên gilover, kevan, stêrk û dubarekirinan nîşan didin.
- **Gav.** Gavên avakirinê bi zimanekî hêsan, bi matematîka li pişt her hejmarê: nîvtîre, goşe, hevbirîn û çima her nirx hatiye hilbijartin. (Niha bi îngilîzî ne.)
- **Primîtîv.** Ji bo her parçeyeke sereke rêzek: nasname, qat, cureya primîtîvê û nirx. Nîşeyek dibêje kengî parçeyek tenê ji bo hin nirxên parametreyê tê xêzkirin.
- **Pîvan.** Hejmarên ku ji şiklê bi parametreyên wê yên standard hatine hesabkirin.

## Nirxên primîtîvan

Nirx wek di taybetnameyê de hatine nivîsandin, bi yekîneyên torê, û goşe bi pileyan.

| Cure         | Nirx                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `line`       | `x1 y1 x2 y2`: her du xalên dawiyê                                                                |
| `circle`     | `cx cy r`: navend û nîvtîre                                                                       |
| `dot`        | `cx cy r`: giloverekî dagirtî, nîvtîre 1 heke nehatibe dayîn                                      |
| `arc`        | `cx cy r start end`: pile bi rêya demjimêrê ji eksena x ya erênî (demjimêr 3)                     |
| `polyline`   | `points`: xeteke vekirî di nav xalan re                                                           |
| `polygon`    | `points`: doreke girtî                                                                            |
| `path`       | `d`: daneyên rêça SVG, tenê `M L H V C Q Z` ên mutleq; hejmarên piştî `C` û `Q` xalên kontrolê ne |
| `rect`       | `x y width height`                                                                                |
| `ellipse`    | `cx cy rx ry`                                                                                     |
| `star`       | `cx cy points outerRadius innerRadius rotation`                                                   |
| `repeat`     | `count` kopiyên hêmanê, her yek bi `step` tê livandin, an li ser `spread` belav dibe              |
| `radial`     | `count` kopî li dora `center`, ji `start` li ser `sweep` pileyan                                  |
| `concentric` | `count` kopî li dora `center`, kopiya i bi 1 − i × `scaleStep` tê piçûkkirin                      |
| `use`        | şiklekî din, bi mezinahiya tevahî, bi `translate` an `rotate` ya vebijarkî                        |

`param rays` li şûna hejmarekê tê wê wateyê ku nirx ji parametreya şiklê ya bi wî navî tê. Beşa **Parametre** ya rûpelê wan bi nirxên standard rêz dike. `filled` parçeyekê nîşan dide ku wek dagirtin tê rengkirin, ne wek xet.

`radial` bi sweep 360 kopiyên xwe bi dûriya 360 / count ji hev datîne. Bi sweep piçûktir, kopiya yekem û ya dawî li her du seran in. Bo nimûne, [nîv roj](https://kanilabs.github.io/deq/kmr/icons/roj-half-sun/) bi 7 tîrêjan li ser 180° wan bi dûriya 30° datîne.

## Pîvan

| Pîvan              | Wate                                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| Qutiya dîtbar      | Qutiya li dora mîrekebê, bi xet û serên gilover ve: x, y, firehî × bilindahî |
| Qutiya sînor       | Qutiya li dora xetên navendê, bê xet                                         |
| Navenda dîtinî     | Navenda rûbera rengkirî, li gorî rûberê giran kirî                           |
| Xet li mezinahiyê  | Stûriya xetê (2) li ser aliyê mezintir ê qutiya dîtbar parvekirî             |
| Primîtîvên xêzkirî | Şikl bi nirxên standard dibe çend parçeyên bingehîn                          |

Ji bo şiklekî dagirtî wek Roja Kurdî, her du qutî wek hev in.

## Nimûneya xebitî: Roja Kurdî

[Roja Kurdî](https://kanilabs.github.io/deq/kmr/icons/kurdish-sun/#construction) yek primîtîva `star` e bi `points param rays` (bi standard 21), ji ber vê yekê du rêzên wê hene, yek ji bo her guhertoyê:

1. Stêrkekê bi 21 serên derve û 21 serên hundir xêz bike, sera derve ya yekem rast ber bi jor (zivirîna −90°).
2. Nîvtîreya derve R = 20 / (1 + cos(π/21)) = 10.056, ji ber vê yekê stêrk tam 20 yekîne bilind e. Nîvtîreya hundir R / 2 = 5.028.
3. Navend (12, 12.056): stêrk R li jor navenda xwe diçe lê tenê R cos(π/21) li jêr, ji ber vê yekê navend 0.056 dadikeve da ku qutiya 2 heta 22 navendî be. [Rastkirinên dîtinî](optical-corrections.md) sedemê rave dike.
4. Ji bo guhertoya xetkirî, R − 1 û R/2 − 0.5 (9.056 û 4.528) bi xeteke 2 yekîneyî bi kar bîne, da ku keviya derve bi stêrka dagirtî re li hev bê.

## Ji nû ve xêzkirina şiklekî di amûreke din de

1. Belgeyeke 24 × 24 (pîksel an xal) çêke û toreke 1 yekîneyî vêxe. [Rêberên amûran](../tools/inkscape.md) nîşan didin ka di her bernameyê de çawa.
2. Her primîtîvê ji nirxên wê xêz bike. Gilover û kevan navend û nîvtîre dixwazin; piraniya bernameyan qutiyekê digirin, ji ber vê yekê x = cx − r, y = cy − r û firehî = bilindahî = 2r bi kar bîne.
3. Xetê bike 2 bi serên û girêkên gilover, û xalan wek giloverên dagirtî yên nîvtîre 1 xêz bike.
4. Bi SVG ya girêdana **SVG daxe** ya rûpela îkonê re bide ber hev. Bi gelemperî destpêkirin ji wê pelê zûtir e.

## Paşê

- [Navber û pêkhatin](composition.md)
- [Reng û gihîştinbarî](colour.md)
