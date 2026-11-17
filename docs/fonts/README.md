# Deq icon fonts

Three fonts carry every Deq shape:

| Font                 | Files                                    | Use it for                                    |
| -------------------- | ---------------------------------------- | --------------------------------------------- |
| Deq Icons            | `DeqIcons-Regular.otf`, `.ttf`, `.woff2` | One-colour icons at the default stroke width. |
| Deq Icons (variable) | `DeqIcons[DOTS,wght].ttf`, `.woff2`      | Any stroke weight and dot size.               |
| Deq Icons Color      | `DeqIconsColor-Regular.ttf`, `.woff2`    | Icons in the Kurdish flag colours.            |

The built files, `deq-icons.css` and `codepoints.json` are attached to each GitHub release as `deq-fonts-<version>.zip`. They are not committed; until the first release, build them with `just fonts`. The fonts are licensed under GPL-3.0-or-later with the Font Exception, so you can embed them in websites, apps and documents under any license (see [`fonts/LICENSE.md`](../../fonts/LICENSE.md)).

## Typing icons

Each icon has two ways in:

- **Ligatures.** Type the icon's id (`roj-half-sun`), an alias, or its Kurmanji name in ASCII (`roj`, `heyv`, `xezal`) and the font shows the icon. Capitals work too (`Roj`). Ligatures are in both `liga` and `calt`, so apps that only apply one of them still show the icon.
- **Code points.** Every icon has a Private Use Area code point from U+E000. The full list is in [`codepoints.md`](codepoints.md) and, for tools, `codepoints.json`. Code points never change and are never reused; new icons get the next free one.

Text that is not an icon name is drawn with simple monoline letters (a–z, 0–9 and `-`), so a half-typed name stays readable.

## On the web

```html
<link rel="stylesheet" href="deq-icons.css" />

<!-- Ligature -->
<span class="deq" aria-hidden="true">roj</span>

<!-- Class, using the code point -->
<span class="deq deq-roj-half-sun" aria-hidden="true"></span>

<!-- Colour font -->
<span class="deq-color deq-kurdish-sun" aria-hidden="true"></span>
```

`deq-icons.css` declares both families with `font-display: block` (no flash of letters while the font loads), the `.deq` and `.deq-color` classes and one `.deq-<id>::before` class per icon. Icon fonts are not read out as images: mark decorative icons `aria-hidden="true"` and give meaningful ones a text label next to them, or use the SVG packages (`@0xdolan/deq-icons`, `-react`, `-vue`, `-svelte`, `-elements`), which set `role="img"` and an accessible name.

### Weight and dots

The variable font has two axes:

| Axis   | Range   | Default | Effect                                                        |
| ------ | ------- | ------- | ------------------------------------------------------------- |
| `wght` | 100–900 | 400     | Stroke width: 100 = 0.5, 400 = 2 (the icon default), 900 = 3. |
| `DOTS` | 50–200  | 100     | Dot radius in percent.                                        |

Named instances: Thin (100), ExtraLight, Light, Regular (400), Medium, SemiBold, Bold, ExtraBold, Black (900).

```css
.deq {
  font-weight: 300;
  font-variation-settings: "DOTS" 150;
}
```

Browsers without variable fonts fall back to `DeqIcons-Regular.woff2`.

### Colour palettes

The colour font is COLRv1 with an OT-SVG copy for renderers that lack COLRv1. It has three CPAL palettes:

| Index | Name       | Colours                                                         |
| ----- | ---------- | --------------------------------------------------------------- |
| 0     | Light      | red `#ED2024`, green `#278E43`, yellow `#FEBD11`, ink `#1A1A1A` |
| 1     | Dark       | red `#FF5A5E`, green `#4CC26A`, yellow `#FEBD11`, ink `#F2F2F2` |
| 2     | Monochrome | all `#000000`                                                   |

Pick one with `font-palette`:

```css
@font-palette-values --deq-dark {
  font-family: "Deq Icons Color";
  base-palette: 1;
}
.dark .deq-color {
  font-palette: --deq-dark;
}
```

The OT-SVG copy always uses the light palette.

## Installing on a computer

- **Linux:** copy the `.otf` or `.ttf` files to `~/.local/share/fonts/` and run `fc-cache -f`. Check with `fc-list | grep "Deq Icons"`.
- **macOS:** double-click a font file and click **Install Font** in Font Book, or copy the files to `~/Library/Fonts/`.
- **Windows:** right-click the font files and choose **Install** (or **Install for all users**).

Install either the static or the variable font for "Deq Icons", not both, so apps don't show the family twice. Design apps that support ligatures (Figma, Illustrator, Inkscape, LibreOffice) show the icon as you type its name.

## Building

```sh
just fonts        # build into fonts/dist and check the code point table
just fonts-check  # also run fontbakery (with ots) and a fontconfig install check
```

`just fonts` builds `@0xdolan/deq-core`, writes the shape geometry with `pnpm --filter @0xdolan/deq-icons font-data fonts/build/geometry.json`, and runs `uv run deq-fonts build`. After adding shapes, run `uv run deq-fonts codepoints` to assign their code points and update [`codepoints.md`](codepoints.md). How the outlines are made is in [ADR 0010](../decisions/0010-icon-packages-and-fonts.md).
