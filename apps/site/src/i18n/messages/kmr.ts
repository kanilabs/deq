/**
 * Kurmanji (kmr, Latin script) UI strings.
 * Status: AI-drafted, needs native review (ADR 0012, Q10).
 */
import type { Messages } from "./en.ts";

export const kmr = {
  "site.title": "Deq",
  "site.tagline":
    "Motîfên deqên kurdî yên kevneşopî wek pergaleke sêwiranê ya vekirî û parametrîk.",
  "site.description":
    "Deq motîfên deqên kurdî yên kevneşopî dike îkon, font û amûrên vekirî, bi çîrokeke çandî ya bi çavkanî.",

  "nav.home": "Destpêk",
  "nav.icons": "Îkon",
  "nav.flag": "Ala",
  "nav.fonts": "Font",
  "nav.brand": "Marka",
  "nav.about": "Derbarê me",
  "nav.docs": "Belge",
  "nav.explore": "Bigere",

  "review.notice":
    "Ev werger bi alîkariya AI hatiye amadekirin û divê axêverekî zikmakî lê binêre.",
  "review.badge": "Pêdivî bi kontrola zikmakî heye",

  "home.title": "Deq: motîfên deqên kurdî wek îkonên vekirî",
  "home.hero.title": "Motîfên deqên kurdî, wek pergaleke sêwiranê ya vekirî hatine xêzkirin",
  "home.hero.tagline":
    "{count} şikil li ser yek tora 24 yekeyî, di TypeScript, Python û Rust de wek hev têne xêzkirin, bi pakêtên îkonan, font û amûreke rêzika fermanê.",
  "home.cta.icons": "Li îkonan binêre",
  "home.cta.docs": "Belgeyan bixwîne",
  "home.quickstart.title": "Destpêka bilez",
  "home.quickstart.body": "Pakêtekê saz bike û şikilekî wek SVG xêz bike.",
  "home.featured.title": "Şikilên bijartî",
  "home.explore.title": "Bigere",
  "home.card.icons": "Hemû şikil bi nav, parametre û xalên kodê.",
  "home.card.flag": "Ala Kurdistanê, li gorî taybetmendiya wê ya weşandî hatiye avakirin.",
  "home.card.fonts": "Fontên îkonan ên sabît, guherbar û rengîn.",
  "home.card.brand": "Nîşana Deqê, reng û rêzikên bikaranînê.",
  "home.card.docs": "Pakêt, amûra rêzika fermanê, port û formata şikilan.",
  "home.card.about": "Proje, nivîskar, lîsans û çawa beşdar bibî.",

  "icons.title": "Îkon",
  "icons.description":
    "Hemû {count} şikilên Deqê, li gorî kategoriyan. Her îkon di bin GPL de belaş e.",
  "icons.search.label": "Îkonan parzûn bike",
  "icons.search.placeholder": "Nav, etîket an navê din",
  "icons.category.label": "Kategorî",
  "icons.category.all": "Hemû kategorî",
  "icons.results": "{count} ji {total} şikilan",
  "icons.empty": "Tu şikil li gorî vê parzûnê nayê.",
  "icons.noscript": "Parzûn pêdivî bi JavaScript heye; hemû şikil li jêr hatine rêzkirin.",

  "icon.title": "Îkona {name}",
  "icon.description": "Motîfa deqê {name} ({category}): SVG, nav, parametre û xala kodê ya fontê.",
  "icon.back": "Hemû îkon",
  "icon.preview": "Pêşdîtin",
  "icon.details": "Hûrgulî",
  "icon.category": "Kategorî",
  "icon.id": "Nasname",
  "icon.tags": "Etîket",
  "icon.aliases": "Navên din",
  "icon.layers": "Tebeqe",
  "icon.symmetry": "Sîmetrî",
  "icon.parameters": "Parametre",
  "icon.parameter.default": "standard {value}",
  "icon.codepoint": "Xala kodê ya fontê",
  "icon.names": "Nav",
  "icon.name.en": "Îngilîzî",
  "icon.name.ckb": "Soranî",
  "icon.name.kmr": "Kurmancî",
  "icon.name.unknown": "Hêj nehatiye tomarkirin",
  "icon.usage": "Bikaranîn",
  "icon.download": "SVG daxe",
  "icon.none": "Tune",
  "icon.prev": "Şikilê berê",
  "icon.next": "Şikilê pêş",

  "category.celestial": "Asîmanî",
  "category.nature": "Xweza",
  "category.geometric": "Geometrîk",
  "category.dots": "Xal",
  "category.lines-and-borders": "Xet û sînor",
  "category.human-and-animal": "Mirov û heywan",
  "category.compositions": "Kompozîsyon",
  "category.kurdish-symbols": "Sembolên kurdî",

  "flag.title": "Ala Kurdistanê",
  "flag.description":
    "Ala Kurdistanê li gorî taybetmendiya wê: sê xetên wekhev û rojek bi 21 tîrêjan, di hemû guhertoyên pejirandî de.",
  "flag.intro":
    "Xetên sor, spî û kesk bi bilindahiya wekhev, bi rojeke zer a 21 tîrêjî li navîn. Rêje 3:2 ye, tîrêja yekem ber bi jor e, û roj nîvê bilindahiya alayê ye.",
  "flag.colors": "Reng",
  "flag.variants": "Guherto",
  "flag.variant.full-color": "Rengê tevahî",
  "flag.variant.mono-black": "Yekreng reş",
  "flag.variant.mono-white": "Yekreng spî",
  "flag.variant.outline": "Xêza derve",
  "flag.variant.high-contrast": "Kontrasta bilind",
  "flag.variant.square": "Çargoşe",
  "flag.color.red": "Sor",
  "flag.color.white": "Spî",
  "flag.color.green": "Kesk",
  "flag.color.yellow": "Zer",
  "flag.contrast":
    "Tu cotek ji rengên alayê nagihîje kontrasta 4.5:1 ku ji bo nivîsê pêwîst e. Li ser rengên alayê nivîsa reş an spî bi kar bîne.",
  "flag.rules": "Tu carî rengê alayê neguherîne, dirêj neke û hejmara tîrêjan neguherîne.",

  "fonts.title": "Font",
  "fonts.description":
    "Fontên îkonan ên Deqê: fonteke sabît, fonteke guherbar bi eksenên giranî û xalan, û fonteke rengîn.",
  "fonts.intro":
    "Her şikil xaleke kodê ya sabît di Qada Bikaranîna Taybet de heye, ji U+E000 dest pê dike. Xalên kodê tu carî nayên guhertin an dîsa bikaranîn.",
  "fonts.static": "Sabît",
  "fonts.static.body": "Yek giranî, wek OTF, TTF û WOFF2.",
  "fonts.variable": "Guherbar",
  "fonts.variable.body": "Eksena giraniyê (wght) û eksena mezinahiya xalan (DOTS).",
  "fonts.color": "Rengîn",
  "fonts.color.body": "COLRv1 bi OT-SVG wek alternatîf, bi rengên alayê.",
  "fonts.specimen": "Nimûne",
  "fonts.weight": "Giranî",
  "fonts.install": "Sazkirin",
  "fonts.install.body":
    "CSS û nexşeya xalên kodê ji pakêta îkonan bi kar bîne, an pelên fontê li ser pergala xwe saz bike.",

  "brand.title": "Marka",
  "brand.description": "Nîşana Deqê, rengên wê û rêzikên bikaranîna alayê û roja kurdî.",
  "brand.logo": "Nîşan",
  "brand.logo.body":
    "Nîşana Deqê gulxala ji katalogê ye: xelekek û heşt xal li dora wê, ji danasîna şikil di nav dîska Kanî Labs de hatiye xêzkirin, bi keskê mûrekeba deqê û zerê roja kurdî. Hêj nîşana nivîskî tune.",
  "brand.colors": "Reng",
  "brand.rules": "Rêzik",
  "brand.rule.contrast": "Nivîs û wate divê kontrasta WCAG AA bi cih bînin.",
  "brand.rule.flag": "Tenê guhertoyên alayê yên li ser rûpela alayê bi kar bîne.",
  "brand.rule.yellow": "Tu carî zer li ser spî an sor li ser kesk ji bo wateyê bi kar neyne.",

  "about.title": "Derbarê me",
  "about.description": "Kî Deqê çêdike, bi kîjan lîsansê, û çawa beşdar bibî.",
  "about.project": "Proje",
  "about.project.body":
    "Deq motîfên deqên kurdî yên kevneşopî ji çavkaniyên weşandî berhev dike û wek pergaleke sêwiranê ya parametrîk ji nû ve xêz dike. Her gotinek li ser wateya motîfekê bi çavkanî ye.",
  "about.author": "Nivîskar",
  "about.license": "Lîsans",
  "about.license.body":
    "Kod û şikil di bin GPL-3.0-or-later de ne. Font GPL bi Îstîsnaya Fontê bi kar tînin, ji ber vê belgeyên ku wan dihewînin bandor nabin.",
  "about.contribute": "Beşdar bibe",
  "about.contribute.body":
    "Rastkirinên nav, werger û çavkaniyan bi xêr hatin. Li GitHub pirsgirêkek an daxwaza guhertinê veke.",
  "about.translations": "Werger",
  "about.translations.body":
    "Nivîsên soranî û kurmancî yên vê malperê bi alîkariya AI hatine amadekirin û li benda kontrola axêverên zikmakî ne.",
  "about.source": "Koda çavkaniyê li GitHub",

  "notFound.title": "Rûpel nehat dîtin",
  "notFound.body": "Ev rûpel tune. Dibe ku hatibe guhastin, an navnîşan şaş be.",
  "notFound.home": "Here rûpela destpêkê",

  "pwa.update": "Guhertoyeke nû ya vê malperê heye.",
  "pwa.reload": "Ji nû ve bar bike",
  "pwa.dismiss": "Paşê",
} as const satisfies Messages;
