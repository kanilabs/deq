---
title: Navber û pêkhatin
description: Çawa şiklên Deqê li kêleka hev deynî, wan di sêwiranên mezintir de bi hev re berhev bikî û navberan wekhev bihêlî.
sidebar:
  order: 5
---

> Ev nivîs pêşnûmeyek e û hîn divê axêverên kurmancî lê binêrin. Rastkirin di [lîsteya pirsgirêkan](https://github.com/kanilabs/deq/issues) de bi xêr hatin.

Şiklên Deqê yek tor, yek xet û yek koma parçeyan parve dikin, ji ber vê yekê heta ku çend rêzik bên parastin, ew baş bi hev re li hev tên.

## Di nav şiklekî de

- **3 yekîne di navbera xetên navendê yên paralel de**, ji ber vê yekê 1 yekîne valahî di navbera xetên 2 yekîneyî de. Ji bo xetên xwar bi goşeya rast li ser xetan bipîve.
- **Tîrêj 2.5 piştî giloverê xwe dest pê dikin**: valahî li ser her rojê wek hev e.
- **Dubarekirin gavên sabît bi kar tînin**: 4.5 ji bo xetên 45°, 3 ji bo diran û nîşanan.

## Berhevkirina şiklan

Çend şiklên katalogê pêkhatinên şiklên din in. Ew her parçeyê bi `use` **bi mezinahiya tevahî** datînin:

- Mezinkirin an piçûkkirina şiklekî dê gilover, xal û valahiyên wê jî biguherîne, ji ber vê yekê ew êdî bi modulan re li hev nayên.
- Parçe tên livandin, mezinahiya wan nayê guhertin. Bo nimûne, [gilover li ser şe](https://kanilabs.github.io/deq/kmr/icons/circle-over-comb/) giloverê rojê (r 5) bi navenda li ser y 8.5 li jor şeyeke heft diranî datîne ku darikê wê li ser y 20.5 ye. Ev 2 yekîne valahî di navbera gilover û serên diranan de dihêle, û hemû li ser torê navendî ye.

Di sêwiranên xwe de jî heman tiştî bike: şiklên tevahî biliviîne, wan bi heman mezinahiyê bihêle, û herî kêm 1 yekîne (çêtir 2) valahî di navbera mîrekeba şiklên cîran de bihêle.

## Rêz, tor û kenar

- Şiklan bi **heman mezinahiyê** deyne, da ku xetên wan li hev bên. Tevlihevkirina şiklekî 24 px bi yekî 48 px re xeta yek ji wan du qat dike; heke divê tu mezinahiyan tevlihev bikî `absoluteStrokeWidth` bi kar bîne.
- Wan bi **gaveke rêkûpêk** ji hev dûr bixe. [Çêkerê nexşan](../guide/generate.md) bend, tor, gulok û kenaran li ser tora xaneyan ava dike, û vebijarka wê ya **Navber** yekîneyên torê di navbera xaneyan de zêde dike.
- Bend bi hejmareke kit a xaneyan hevseng xuya dikin, li dora navendê neynikî. Bendên çêker 3 heta 63 xaneyan bi kar tînin.
- Di [Stûdyoyê](../guide/studio.md) de, **Pêvegirtin** şiklan li ser torê dihêle, û **Rêzkirin** hilbijartinê rêz û belav dike.

## Şikl li kêleka nivîsê

- Mezinahiya şiklê li gorî bilindahiya rêzê bike, bo nimûne 24 px bi nivîsa 16 px. [Pakêtên îkonan](../../dev/packages.md) bi standard 24 px in.
- `absoluteStrokeWidth` bi kar bîne da ku xet di mezinahiyên mezintir de bi qasî nivîsê giran bimîne.
- Fonta Deq Leet nivîsê bi motîfan dinivîse; binêre [Deq Leet](../guide/leet.md).

## Zivirandin û neynikkirin

`rotation`, `flipX` û `flipY` şiklekî li dora navenda kanvasê dizivirînin û neynikî dikin. Sîmetriya şiklekî (li ser rûpela wê ya îkonê tê nîşandan) ji te re dibêje kîjan ji wan wê naguherînin: şiklekî `mirror-x` bi çep û rast zivirandinê wek xwe xuya dike, û şiklekî `rotational-4` piştî çaryek zivirînê.

## Paşê

- [Reng û gihîştinbarî](colour.md)
