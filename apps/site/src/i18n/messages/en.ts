/**
 * English UI strings: the source catalog. Every other locale must have exactly these keys
 * (`satisfies Messages` in each catalog, plus `test/i18n.test.ts`).
 * Placeholders use `{name}` and are filled by `format()`.
 */
export const en = {
  "site.title": "Deq",
  "site.tagline": "Traditional Kurdish tattoo motifs as an open, parametric design system.",
  "site.description":
    "Deq turns traditional Kurdish tattoo (deq) motifs into open icons, fonts and tools, with a cited cultural story.",

  "nav.home": "Home",
  "nav.icons": "Icons",
  "nav.flag": "Flag",
  "nav.fonts": "Fonts",
  "nav.brand": "Brand",
  "nav.about": "About",
  "nav.docs": "Docs",
  "nav.explore": "Explore",

  "review.notice": "This translation was drafted by AI and needs review by a native speaker.",
  "review.badge": "Needs native review",

  "home.title": "Deq: Kurdish tattoo motifs as open icons",
  "home.hero.title": "Kurdish deq motifs, drawn as an open design system",
  "home.hero.tagline":
    "{count} shapes on one 24-unit grid, rendered the same in TypeScript, Python and Rust, with icon packages, fonts and a command-line tool.",
  "home.cta.icons": "Browse the icons",
  "home.cta.docs": "Read the docs",
  "home.quickstart.title": "Quick start",
  "home.quickstart.body": "Install a package and render a shape as SVG.",
  "home.featured.title": "Featured shapes",
  "home.explore.title": "Explore",
  "home.card.icons": "Every shape with its names, parameters and code points.",
  "home.card.flag": "The flag of Kurdistan, built from its published specification.",
  "home.card.fonts": "Static, variable and colour icon fonts.",
  "home.card.brand": "The Deq mark, colours and usage rules.",
  "home.card.docs": "Packages, the command-line tool, ports and the shape format.",
  "home.card.about": "The project, the author, the licence and how to contribute.",

  "icons.title": "Icons",
  "icons.description":
    "All {count} Deq shapes, grouped by category. Every icon is free to use under the GPL.",
  "icons.search.label": "Filter icons",
  "icons.search.placeholder": "Name, tag or alias",
  "icons.category.label": "Category",
  "icons.category.all": "All categories",
  "icons.results": "{count} of {total} shapes",
  "icons.empty": "No shape matches this filter.",
  "icons.noscript": "Filtering needs JavaScript; all shapes are listed below.",

  "icon.title": "{name} icon",
  "icon.description":
    "The {name} deq motif ({category}): SVG, names, parameters and font code point.",
  "icon.back": "All icons",
  "icon.preview": "Preview",
  "icon.details": "Details",
  "icon.category": "Category",
  "icon.id": "ID",
  "icon.tags": "Tags",
  "icon.aliases": "Aliases",
  "icon.layers": "Layers",
  "icon.symmetry": "Symmetry",
  "icon.parameters": "Parameters",
  "icon.parameter.default": "default {value}",
  "icon.codepoint": "Font code point",
  "icon.names": "Names",
  "icon.name.en": "English",
  "icon.name.ckb": "Sorani",
  "icon.name.kmr": "Kurmanji",
  "icon.name.unknown": "Not yet recorded",
  "icon.usage": "Usage",
  "icon.download": "Download SVG",
  "icon.none": "None",
  "icon.prev": "Previous shape",
  "icon.next": "Next shape",

  "category.celestial": "Celestial",
  "category.nature": "Nature",
  "category.geometric": "Geometric",
  "category.dots": "Dots",
  "category.lines-and-borders": "Lines and borders",
  "category.human-and-animal": "Human and animal",
  "category.compositions": "Compositions",
  "category.kurdish-symbols": "Kurdish symbols",

  "flag.title": "Flag of Kurdistan",
  "flag.description":
    "The flag of Kurdistan drawn from its specification: three equal bands and a sun of 21 rays, in every approved variant.",
  "flag.intro":
    "Red, white and green bands of equal height, with a yellow sun of 21 rays in the centre. The ratio is 3:2, the first ray points up, and the sun is half the flag height.",
  "flag.colors": "Colours",
  "flag.variants": "Variants",
  "flag.variant.full-color": "Full colour",
  "flag.variant.mono-black": "Mono black",
  "flag.variant.mono-white": "Mono white",
  "flag.variant.outline": "Outline",
  "flag.variant.high-contrast": "High contrast",
  "flag.variant.square": "Square",
  "flag.color.red": "Red",
  "flag.color.white": "White",
  "flag.color.green": "Green",
  "flag.color.yellow": "Yellow",
  "flag.contrast":
    "No pair of flag colours reaches the 4.5:1 contrast needed for body text. Use black or white text on the flag colours.",
  "flag.rules": "Never recolour, stretch or change the ray count of the flag.",

  "fonts.title": "Fonts",
  "fonts.description":
    "The Deq icon fonts: a static font, a variable font with weight and dots axes, and a colour font.",
  "fonts.intro":
    "Each shape has a fixed code point in the Private Use Area, starting at U+E000. Code points are never changed or reused.",
  "fonts.static": "Static",
  "fonts.static.body": "One weight, as OTF, TTF and WOFF2.",
  "fonts.variable": "Variable",
  "fonts.variable.body": "A weight axis (wght) and a dot size axis (DOTS).",
  "fonts.color": "Colour",
  "fonts.color.body": "COLRv1 with an OT-SVG fallback, in the flag colours.",
  "fonts.specimen": "Specimen",
  "fonts.weight": "Weight",
  "fonts.install": "Install",
  "fonts.install.body":
    "Use the CSS and the code point map from the icons package, or install the font files on your system.",

  "brand.title": "Brand",
  "brand.description":
    "The Deq mark, its colours and the rules for using the flag and the Kurdish sun.",
  "brand.logo": "The mark",
  "brand.logo.body":
    "The Deq mark is the chin mark: a V pointing down with a dot above it, drawn on the same grid as every shape. There is no wordmark yet.",
  "brand.colors": "Colours",
  "brand.rules": "Rules",
  "brand.rule.contrast": "Text and meaning must meet WCAG AA contrast.",
  "brand.rule.flag": "Use only the flag variants listed on the flag page.",
  "brand.rule.yellow": "Never put yellow on white or red on green to carry meaning.",

  "about.title": "About",
  "about.description": "Who makes Deq, under which licence, and how to contribute.",
  "about.project": "The project",
  "about.project.body":
    "Deq collects traditional Kurdish tattoo motifs from published sources and redraws them as a parametric design system. Every claim about a motif's meaning is cited.",
  "about.author": "Author",
  "about.license": "Licence",
  "about.license.body":
    "The code and the shapes are licensed under GPL-3.0-or-later. The fonts use the GPL with the Font Exception, so documents that embed them are not affected.",
  "about.contribute": "Contribute",
  "about.contribute.body":
    "Corrections to names, translations and sources are welcome. Open an issue or a pull request on GitHub.",
  "about.translations": "Translations",
  "about.translations.body":
    "The Sorani and Kurmanji texts on this site were drafted with AI help and are waiting for review by native speakers.",
  "about.source": "Source code on GitHub",

  "notFound.title": "Page not found",
  "notFound.body": "This page does not exist. It may have moved, or the address may be wrong.",
  "notFound.home": "Go to the home page",

  "pwa.update": "A new version of this site is available.",
  "pwa.reload": "Reload",
  "pwa.dismiss": "Later",
} as const;

/** The shape every locale's catalog must have. */
export type Messages = { readonly [K in keyof typeof en]: string };

/** A UI string key. */
export type MessageKey = keyof Messages;
