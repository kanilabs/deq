---
title: Reng û gihîştinbarî
description: Rengkirina şiklên Deqê, rengên alayê û berevajiya wan, û gihîştinbarkirina îkonan.
sidebar:
  order: 6
---

> Ev nivîs pêşnûmeyek e û hîn divê axêverên kurmancî lê binêrin. Rastkirin di [lîsteya pirsgirêkan](https://github.com/kanilabs/deq/issues) de bi xêr hatin.

Şiklên Deqê rengê xwe tune ne. Ew bi `currentColor` tên xêzkirin, ji ber vê yekê rengê nivîsa derdora xwe digirin, û tu rengê li cihê ku wan bi kar tînî hildibijêrî.

## Vebijarkên rengan

| Vebijark        | Standard       | Çi dike                                                    |
| --------------- | -------------- | ---------------------------------------------------------- |
| `color`         | `currentColor` | Rengê xet û xalan (her rengekî CSS)                        |
| `layerColors`   | tune           | Rengek ji bo her qatê, bo nimûne `{ "rays": "#FEBD11" }`   |
| `fill`          | `none`         | Dagirtin ji bo dorên girtî (gilover, pirgoşe, rêçên girtî) |
| `fillOpacity`   | 1              | Nezelaliya dagirtinê                                       |
| `strokeOpacity` | 1              | Nezelaliya xet û xalan                                     |
| `background`    | `none`         | Rengek li pişt tevahiya şiklê                              |

Heman vebijark di inspektora Stûdyoyê de ne (**Reng**, **Rengên qatan**, **Dagirtin**, **Paşxane**), li ser [rêza fermanê](../../api/commands.md) û di her pakêtê de. Navên qatan li ser her rûpela îkonê hatine rêzkirin. Di amûrên sêwiranê de, komên Layered SVG reng bike; [rêberên amûran](../tools/inkscape.md) nîşan didin ka çawa.

## Rengên alayê

Ala Kurdistanê çar rengan bi kar tîne, ji [`spec/flag.json`](../../../spec/flag.json):

| Reng | Hex       |
| ---- | --------- |
| Sor  | `#ED2024` |
| Spî  | `#FFFFFF` |
| Kesk | `#278E43` |
| Zer  | `#FEBD11` |

Ew paleteke xwezayî ne ji bo sêwiranên Deqê, lê tu cotek ji wan ji bo nivîsa piçûk têra xwe xurt nîne. Rêjeyên berevajiya wan (WCAG 2), ku lint kontrol dike:

| Cot             | Rêje | Bikaranîn                                                  |
| --------------- | ---- | ---------------------------------------------------------- |
| Sor li ser spî  | 4.35 | Tenê grafîk û nivîsa mezin (3:1 hewce ye); ne nivîsa piçûk |
| Spî li ser kesk | 4.17 | Tenê grafîk û nivîsa mezin                                 |
| Sor li ser zer  | 2.59 | Tenê xemilandin                                            |
| Kesk li ser zer | 2.48 | Tenê xemilandin                                            |
| Zer li ser spî  | 1.68 | Qet ji bo gihandina wateyê                                 |
| Sor li ser kesk | 1.04 | Qet ji bo gihandina wateyê                                 |

Dema şiklek wateyekê digihîne (bişkojk, rewş, girêdan), herî kêm berevajiya **3:1** li hember paşxaneya wê bide, kêmtirîna WCAG ji bo grafîkan. Mîrekeba reş an spî li ser rengekî alayê bi gelemperî hilbijartina ewle ye. Qet rengê alayê bi xwe neguherîne, wê dirêj neke û tîrêjên wê neguherîne; binêre [rêbera alayê](../guide/flag.md).

## Ronî û tarî

`currentColor` rengê nivîsê dişopîne, ji ber vê yekê şiklek di nav nivîsê de bi xwe bi rûkara ronî an tarî re diguhere. Rengên sabît wisa nakin: wan li ser her du paşxaneyan kontrol bike, an rengên taybet bide rûkara tarî.

## Îkonên gihîştinbar

- Şiklekî bi wate navek hewce dike. Renderer `<title>`, `role="img"` û `aria-label` didin SVGyê, hemû bi standard navê îngilîzî yê şiklê. `title` an `ariaLabel` deyne da ku tiştê ku îkon dike rave bike, bo nimûne "Daxistin".
- Şiklekî xemilandî li kêleka nivîsekê ku heman tiştî dibêje divê ji xwendevanên ekranê were veşartin: `title: ""` bide, û SVG li şûna wê `aria-hidden="true"` digire.
- Tenê reng ji bo cudakirina şiklan bi kar neyne; şiklê jî biguherîne.
- Di mezinahiyên piçûk de 24 px û xeta standard bihêle. Xetên ji 1.5 px ziravtir bi zehmet tên dîtin.

## Paşê

- [Rêberên amûran](../tools/inkscape.md)
