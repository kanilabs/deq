// Generated from spec/cli.json by scripts/generate.ts.
// Do not edit: run `pnpm --filter @0xdolan/deq-cli generate`.
import type { CliData } from "../types.js";

export const CLI: CliData = {
  "name": "deq",
  "version": "0.0.0",
  "formats": {
    "all": [
      "svg",
      "svg-layered",
      "svg-sprite",
      "html",
      "jsx",
      "tsx",
      "vue",
      "svelte",
      "data-uri",
      "css-background",
      "css-mask",
      "pdf",
      "ai",
      "eps",
      "png",
      "jpg",
      "webp",
      "avif",
      "ico",
      "favicon",
      "psd",
      "figma",
      "spec-json"
    ],
    "ports": [
      "svg",
      "svg-layered",
      "svg-sprite",
      "pdf",
      "png",
      "jpg",
      "webp",
      "ico"
    ]
  },
  "globalFlags": [
    {
      "name": "help",
      "short": "h",
      "type": "bool",
      "help": "Show help."
    },
    {
      "name": "version",
      "short": "V",
      "type": "bool",
      "help": "Print the version."
    }
  ],
  "exitCodes": [
    {
      "code": 0,
      "meaning": "success"
    },
    {
      "code": 1,
      "meaning": "a shape, option or spec file is invalid"
    },
    {
      "code": 2,
      "meaning": "the command line is wrong"
    },
    {
      "code": 3,
      "meaning": "a file could not be read or written (or exists without --force)"
    },
    {
      "code": 4,
      "meaning": "the format is only available in the Node CLI"
    }
  ],
  "commands": [
    {
      "name": "list",
      "summary": "List the shapes in the catalog.",
      "args": [],
      "flags": [
        {
          "name": "category",
          "type": "string",
          "value": "id",
          "help": "Only shapes in this category."
        },
        {
          "name": "json",
          "type": "bool",
          "help": "Print JSON."
        }
      ]
    },
    {
      "name": "info",
      "summary": "Show a shape's names, layers and parameters.",
      "args": [
        {
          "name": "shape",
          "help": "Shape id (see deq list).",
          "complete": "shape"
        }
      ],
      "flags": [
        {
          "name": "json",
          "type": "bool",
          "help": "Print JSON."
        }
      ]
    },
    {
      "name": "render",
      "summary": "Render shapes to files.",
      "args": [
        {
          "name": "shape",
          "variadic": true,
          "help": "Shape ids (see deq list).",
          "complete": "shape"
        }
      ],
      "flags": [
        {
          "name": "format",
          "type": "choice",
          "choices": [
            "svg",
            "svg-layered",
            "svg-sprite",
            "html",
            "jsx",
            "tsx",
            "vue",
            "svelte",
            "data-uri",
            "css-background",
            "css-mask",
            "pdf",
            "ai",
            "eps",
            "png",
            "jpg",
            "webp",
            "avif",
            "ico",
            "favicon",
            "psd",
            "figma",
            "spec-json"
          ],
          "default": "svg",
          "help": "Output format. Default svg."
        },
        {
          "name": "size",
          "type": "number",
          "value": "px",
          "option": "size",
          "help": "Width and height in px, 1 to 8192. Default 24."
        },
        {
          "name": "layered",
          "type": "bool",
          "help": "SVG with one Inkscape layer per shape layer (same as --format svg-layered)."
        },
        {
          "name": "out",
          "type": "string",
          "value": "path",
          "complete": "file",
          "help": "Output file, or a directory for several files; - writes one file to stdout. Default: the current directory."
        },
        {
          "name": "color",
          "type": "string",
          "value": "color",
          "option": "color",
          "help": "Stroke and dot colour (any CSS colour). Default currentColor."
        },
        {
          "name": "stroke-width",
          "type": "number",
          "value": "n",
          "option": "strokeWidth",
          "help": "Stroke width in grid units, 0.05 to 12. Default 2."
        },
        {
          "name": "absolute-stroke-width",
          "type": "bool",
          "option": "absoluteStrokeWidth",
          "help": "Keep the stroke the same width in px at any size."
        },
        {
          "name": "fill",
          "type": "string",
          "value": "color",
          "option": "fill",
          "help": "Fill for closed outlines, or none. Default none."
        },
        {
          "name": "fill-opacity",
          "type": "number",
          "value": "0-1",
          "option": "fillOpacity",
          "help": "Opacity of the fill. Default 1."
        },
        {
          "name": "stroke-opacity",
          "type": "number",
          "value": "0-1",
          "option": "strokeOpacity",
          "help": "Opacity of strokes and dots. Default 1."
        },
        {
          "name": "linecap",
          "type": "choice",
          "choices": [
            "round",
            "butt",
            "square"
          ],
          "option": "linecap",
          "help": "Line ends. Default round."
        },
        {
          "name": "linejoin",
          "type": "choice",
          "choices": [
            "round",
            "miter",
            "bevel"
          ],
          "option": "linejoin",
          "help": "Line corners. Default round."
        },
        {
          "name": "dot-scale",
          "type": "number",
          "value": "n",
          "option": "dotScale",
          "help": "Multiply every dot radius, 0.1 to 4. Default 1."
        },
        {
          "name": "rotation",
          "type": "number",
          "value": "deg",
          "option": "rotation",
          "help": "Rotate clockwise about the centre. Default 0."
        },
        {
          "name": "flip-x",
          "type": "bool",
          "option": "flipX",
          "help": "Mirror left to right."
        },
        {
          "name": "flip-y",
          "type": "bool",
          "option": "flipY",
          "help": "Mirror top to bottom."
        },
        {
          "name": "padding",
          "type": "number",
          "value": "n",
          "option": "padding",
          "help": "Space around the 24 x 24 canvas in grid units, 0 to 24. Default 0."
        },
        {
          "name": "background",
          "type": "string",
          "value": "color",
          "option": "background",
          "help": "Background colour, or none. Default none."
        },
        {
          "name": "layer-color",
          "type": "pair",
          "value": "layer=color",
          "option": "layerColors",
          "help": "Colour of one layer, for example sun=#FEBD11 (repeatable)."
        },
        {
          "name": "title",
          "type": "string",
          "value": "text",
          "option": "title",
          "help": "Accessible title. Default the English name; \"\" marks the image decorative."
        },
        {
          "name": "param",
          "type": "pair",
          "value": "name=value",
          "option": "params",
          "help": "Shape parameter, for example rays=9 (repeatable; see deq info)."
        },
        {
          "name": "current-color",
          "type": "string",
          "value": "color",
          "help": "What currentColor means in PDF and image formats. Default black."
        },
        {
          "name": "matte",
          "type": "string",
          "value": "color",
          "help": "JPG background behind transparent pixels. Default white."
        },
        {
          "name": "quality",
          "type": "int",
          "value": "0-100",
          "help": "JPG and WebP quality. Default 90."
        },
        {
          "name": "force",
          "type": "bool",
          "help": "Overwrite existing files."
        }
      ]
    },
    {
      "name": "export",
      "summary": "Export shapes in several formats and sizes.",
      "args": [
        {
          "name": "shape",
          "variadic": true,
          "optional": true,
          "help": "Shape ids; or use --all.",
          "complete": "shape"
        }
      ],
      "flags": [
        {
          "name": "all",
          "type": "bool",
          "help": "Export every shape in the catalog."
        },
        {
          "name": "format",
          "type": "list",
          "choices": [
            "svg",
            "svg-layered",
            "svg-sprite",
            "html",
            "jsx",
            "tsx",
            "vue",
            "svelte",
            "data-uri",
            "css-background",
            "css-mask",
            "pdf",
            "ai",
            "eps",
            "png",
            "jpg",
            "webp",
            "avif",
            "ico",
            "favicon",
            "psd",
            "figma",
            "spec-json"
          ],
          "default": "svg",
          "value": "list",
          "help": "Comma-separated formats. Default svg."
        },
        {
          "name": "sizes",
          "type": "intlist",
          "value": "list",
          "default": "24",
          "help": "Comma-separated sizes in px. Default 24."
        },
        {
          "name": "out",
          "type": "string",
          "value": "dir",
          "default": ".",
          "complete": "dir",
          "help": "Output directory; files go to <dir>/<format>/<size>/. Default the current directory."
        },
        {
          "name": "color",
          "type": "string",
          "value": "color",
          "option": "color",
          "help": "Stroke and dot colour (any CSS colour). Default currentColor."
        },
        {
          "name": "stroke-width",
          "type": "number",
          "value": "n",
          "option": "strokeWidth",
          "help": "Stroke width in grid units, 0.05 to 12. Default 2."
        },
        {
          "name": "absolute-stroke-width",
          "type": "bool",
          "option": "absoluteStrokeWidth",
          "help": "Keep the stroke the same width in px at any size."
        },
        {
          "name": "fill",
          "type": "string",
          "value": "color",
          "option": "fill",
          "help": "Fill for closed outlines, or none. Default none."
        },
        {
          "name": "fill-opacity",
          "type": "number",
          "value": "0-1",
          "option": "fillOpacity",
          "help": "Opacity of the fill. Default 1."
        },
        {
          "name": "stroke-opacity",
          "type": "number",
          "value": "0-1",
          "option": "strokeOpacity",
          "help": "Opacity of strokes and dots. Default 1."
        },
        {
          "name": "linecap",
          "type": "choice",
          "choices": [
            "round",
            "butt",
            "square"
          ],
          "option": "linecap",
          "help": "Line ends. Default round."
        },
        {
          "name": "linejoin",
          "type": "choice",
          "choices": [
            "round",
            "miter",
            "bevel"
          ],
          "option": "linejoin",
          "help": "Line corners. Default round."
        },
        {
          "name": "dot-scale",
          "type": "number",
          "value": "n",
          "option": "dotScale",
          "help": "Multiply every dot radius, 0.1 to 4. Default 1."
        },
        {
          "name": "rotation",
          "type": "number",
          "value": "deg",
          "option": "rotation",
          "help": "Rotate clockwise about the centre. Default 0."
        },
        {
          "name": "flip-x",
          "type": "bool",
          "option": "flipX",
          "help": "Mirror left to right."
        },
        {
          "name": "flip-y",
          "type": "bool",
          "option": "flipY",
          "help": "Mirror top to bottom."
        },
        {
          "name": "padding",
          "type": "number",
          "value": "n",
          "option": "padding",
          "help": "Space around the 24 x 24 canvas in grid units, 0 to 24. Default 0."
        },
        {
          "name": "background",
          "type": "string",
          "value": "color",
          "option": "background",
          "help": "Background colour, or none. Default none."
        },
        {
          "name": "layer-color",
          "type": "pair",
          "value": "layer=color",
          "option": "layerColors",
          "help": "Colour of one layer, for example sun=#FEBD11 (repeatable)."
        },
        {
          "name": "title",
          "type": "string",
          "value": "text",
          "option": "title",
          "help": "Accessible title. Default the English name; \"\" marks the image decorative."
        },
        {
          "name": "param",
          "type": "pair",
          "value": "name=value",
          "option": "params",
          "help": "Shape parameter, for example rays=9 (repeatable; see deq info)."
        },
        {
          "name": "current-color",
          "type": "string",
          "value": "color",
          "help": "What currentColor means in PDF and image formats. Default black."
        },
        {
          "name": "matte",
          "type": "string",
          "value": "color",
          "help": "JPG background behind transparent pixels. Default white."
        },
        {
          "name": "quality",
          "type": "int",
          "value": "0-100",
          "help": "JPG and WebP quality. Default 90."
        },
        {
          "name": "force",
          "type": "bool",
          "help": "Overwrite existing files."
        }
      ]
    },
    {
      "name": "flag",
      "summary": "Draw the flag of Kurdistan.",
      "args": [],
      "flags": [
        {
          "name": "variant",
          "type": "choice",
          "choices": [
            "full-color",
            "mono-black",
            "mono-white",
            "outline",
            "high-contrast",
            "square"
          ],
          "default": "full-color",
          "help": "Flag variant. Default full-color."
        },
        {
          "name": "width",
          "type": "int",
          "value": "px",
          "default": "900",
          "help": "Width in px, 1 to 8192; the height follows. Default 900."
        },
        {
          "name": "format",
          "type": "choice",
          "choices": [
            "svg",
            "png",
            "jpg",
            "webp"
          ],
          "default": "svg",
          "help": "Output format. Default svg."
        },
        {
          "name": "title",
          "type": "string",
          "value": "text",
          "help": "Accessible title. Default \"Flag of Kurdistan\"."
        },
        {
          "name": "current-color",
          "type": "string",
          "value": "color",
          "help": "What currentColor means in image formats. Default black."
        },
        {
          "name": "matte",
          "type": "string",
          "value": "color",
          "help": "JPG background behind transparent pixels. Default white."
        },
        {
          "name": "quality",
          "type": "int",
          "value": "0-100",
          "help": "JPG and WebP quality. Default 90."
        },
        {
          "name": "out",
          "type": "string",
          "value": "path",
          "complete": "file",
          "help": "Output file or directory; - writes to stdout. Default: the current directory."
        },
        {
          "name": "force",
          "type": "bool",
          "help": "Overwrite existing files."
        }
      ]
    },
    {
      "name": "validate",
      "summary": "Check a shape spec file and render every parameter variant.",
      "args": [
        {
          "name": "file",
          "help": "Shape spec JSON file.",
          "complete": "file"
        }
      ],
      "flags": []
    },
    {
      "name": "completion",
      "summary": "Print a shell completion script.",
      "args": [
        {
          "name": "shell",
          "choices": [
            "bash",
            "zsh",
            "fish",
            "powershell"
          ],
          "help": "bash, zsh, fish or powershell."
        }
      ],
      "flags": []
    }
  ],
  "help": {
    "": "deq 0.0.0: Draw Deq shapes, traditional Kurdish tattoo motifs, as SVG, PDF and images.\n\nUsage: deq <command> [options]\n\nCommands:\n  list        List the shapes in the catalog.\n  info        Show a shape's names, layers and parameters.\n  render      Render shapes to files.\n  export      Export shapes in several formats and sizes.\n  flag        Draw the flag of Kurdistan.\n  validate    Check a shape spec file and render every parameter variant.\n  completion  Print a shell completion script.\n\nOptions:\n  -h, --help     Show help.\n  -V, --version  Print the version.\n\nExit codes:\n  0  success\n  1  a shape, option or spec file is invalid\n  2  the command line is wrong\n  3  a file could not be read or written (or exists without --force)\n  4  the format is only available in the Node CLI\n\nRun \"deq <command> --help\" for the options of a command.\n",
    "list": "Usage: deq list [options]\n\nList the shapes in the catalog.\n\nOptions:\n      --category <id>  Only shapes in this category.\n      --json           Print JSON.\n  -h, --help           Show help.\n  -V, --version        Print the version.\n",
    "info": "Usage: deq info <shape> [options]\n\nShow a shape's names, layers and parameters.\n\nArguments:\n  <shape>  Shape id (see deq list).\n\nOptions:\n      --json     Print JSON.\n  -h, --help     Show help.\n  -V, --version  Print the version.\n",
    "render": "Usage: deq render <shape...> [options]\n\nRender shapes to files.\n\nArguments:\n  <shape...>  Shape ids (see deq list).\n\nOptions:\n      --format <format>         Output format. Default svg. Values: svg,\n                                svg-layered, svg-sprite, html, jsx, tsx, vue,\n                                svelte, data-uri, css-background, css-mask, pdf,\n                                ai, eps, png, jpg, webp, avif, ico, favicon,\n                                psd, figma, spec-json.\n      --size <px>               Width and height in px, 1 to 8192. Default 24.\n      --layered                 SVG with one Inkscape layer per shape layer\n                                (same as --format svg-layered).\n      --out <path>              Output file, or a directory for several files; -\n                                writes one file to stdout. Default: the current\n                                directory.\n      --color <color>           Stroke and dot colour (any CSS colour). Default\n                                currentColor.\n      --stroke-width <n>        Stroke width in grid units, 0.05 to 12. Default\n                                2.\n      --absolute-stroke-width   Keep the stroke the same width in px at any\n                                size.\n      --fill <color>            Fill for closed outlines, or none. Default none.\n      --fill-opacity <0-1>      Opacity of the fill. Default 1.\n      --stroke-opacity <0-1>    Opacity of strokes and dots. Default 1.\n      --linecap <linecap>       Line ends. Default round. Values: round, butt,\n                                square.\n      --linejoin <linejoin>     Line corners. Default round. Values: round,\n                                miter, bevel.\n      --dot-scale <n>           Multiply every dot radius, 0.1 to 4. Default 1.\n      --rotation <deg>          Rotate clockwise about the centre. Default 0.\n      --flip-x                  Mirror left to right.\n      --flip-y                  Mirror top to bottom.\n      --padding <n>             Space around the 24 x 24 canvas in grid units, 0\n                                to 24. Default 0.\n      --background <color>      Background colour, or none. Default none.\n      --layer-color <layer=color>\n                                Colour of one layer, for example sun=#FEBD11\n                                (repeatable).\n      --title <text>            Accessible title. Default the English name; \"\"\n                                marks the image decorative.\n      --param <name=value>      Shape parameter, for example rays=9 (repeatable;\n                                see deq info).\n      --current-color <color>   What currentColor means in PDF and image\n                                formats. Default black.\n      --matte <color>           JPG background behind transparent pixels.\n                                Default white.\n      --quality <0-100>         JPG and WebP quality. Default 90.\n      --force                   Overwrite existing files.\n  -h, --help                    Show help.\n  -V, --version                 Print the version.\n",
    "export": "Usage: deq export [<shape...>] [options]\n\nExport shapes in several formats and sizes.\n\nArguments:\n  [<shape...>]  Shape ids; or use --all.\n\nOptions:\n      --all                     Export every shape in the catalog.\n      --format <list>           Comma-separated formats. Default svg. Values:\n                                svg, svg-layered, svg-sprite, html, jsx, tsx,\n                                vue, svelte, data-uri, css-background, css-mask,\n                                pdf, ai, eps, png, jpg, webp, avif, ico,\n                                favicon, psd, figma, spec-json.\n      --sizes <list>            Comma-separated sizes in px. Default 24.\n      --out <dir>               Output directory; files go to\n                                <dir>/<format>/<size>/. Default the current\n                                directory.\n      --color <color>           Stroke and dot colour (any CSS colour). Default\n                                currentColor.\n      --stroke-width <n>        Stroke width in grid units, 0.05 to 12. Default\n                                2.\n      --absolute-stroke-width   Keep the stroke the same width in px at any\n                                size.\n      --fill <color>            Fill for closed outlines, or none. Default none.\n      --fill-opacity <0-1>      Opacity of the fill. Default 1.\n      --stroke-opacity <0-1>    Opacity of strokes and dots. Default 1.\n      --linecap <linecap>       Line ends. Default round. Values: round, butt,\n                                square.\n      --linejoin <linejoin>     Line corners. Default round. Values: round,\n                                miter, bevel.\n      --dot-scale <n>           Multiply every dot radius, 0.1 to 4. Default 1.\n      --rotation <deg>          Rotate clockwise about the centre. Default 0.\n      --flip-x                  Mirror left to right.\n      --flip-y                  Mirror top to bottom.\n      --padding <n>             Space around the 24 x 24 canvas in grid units, 0\n                                to 24. Default 0.\n      --background <color>      Background colour, or none. Default none.\n      --layer-color <layer=color>\n                                Colour of one layer, for example sun=#FEBD11\n                                (repeatable).\n      --title <text>            Accessible title. Default the English name; \"\"\n                                marks the image decorative.\n      --param <name=value>      Shape parameter, for example rays=9 (repeatable;\n                                see deq info).\n      --current-color <color>   What currentColor means in PDF and image\n                                formats. Default black.\n      --matte <color>           JPG background behind transparent pixels.\n                                Default white.\n      --quality <0-100>         JPG and WebP quality. Default 90.\n      --force                   Overwrite existing files.\n  -h, --help                    Show help.\n  -V, --version                 Print the version.\n",
    "flag": "Usage: deq flag [options]\n\nDraw the flag of Kurdistan.\n\nOptions:\n      --variant <variant>      Flag variant. Default full-color. Values:\n                               full-color, mono-black, mono-white, outline,\n                               high-contrast, square.\n      --width <px>             Width in px, 1 to 8192; the height follows.\n                               Default 900.\n      --format <format>        Output format. Default svg. Values: svg, png,\n                               jpg, webp.\n      --title <text>           Accessible title. Default \"Flag of Kurdistan\".\n      --current-color <color>  What currentColor means in image formats. Default\n                               black.\n      --matte <color>          JPG background behind transparent pixels. Default\n                               white.\n      --quality <0-100>        JPG and WebP quality. Default 90.\n      --out <path>             Output file or directory; - writes to stdout.\n                               Default: the current directory.\n      --force                  Overwrite existing files.\n  -h, --help                   Show help.\n  -V, --version                Print the version.\n",
    "validate": "Usage: deq validate <file> [options]\n\nCheck a shape spec file and render every parameter variant.\n\nArguments:\n  <file>  Shape spec JSON file.\n\nOptions:\n  -h, --help     Show help.\n  -V, --version  Print the version.\n",
    "completion": "Usage: deq completion <shell> [options]\n\nPrint a shell completion script.\n\nArguments:\n  <shell>  bash, zsh, fish or powershell.\n\nOptions:\n  -h, --help     Show help.\n  -V, --version  Print the version.\n"
  },
  "completions": {
    "bash": "# bash completion for deq. Generated from spec/cli.json; do not edit.\n# Install: deq completion bash > ~/.local/share/bash-completion/completions/deq\n_deq() {\n  local cur prev\n  cur=\"${COMP_WORDS[COMP_CWORD]}\"\n  prev=\"${COMP_WORDS[COMP_CWORD-1]}\"\n  if [[ $COMP_CWORD -eq 1 ]]; then\n    COMPREPLY=($(compgen -W \"list info render export flag validate completion --help --version\" -- \"$cur\"))\n    return\n  fi\n  case \"${COMP_WORDS[1]}\" in\n    list)\n      case \"$prev\" in\n        --category) return ;;\n      esac\n      if [[ $cur == -* ]]; then COMPREPLY=($(compgen -W \"--category --json --help\" -- \"$cur\")); return; fi\n      ;;\n    info)\n      if [[ $cur == -* ]]; then COMPREPLY=($(compgen -W \"--json --help\" -- \"$cur\")); return; fi\n      COMPREPLY=($(compgen -W \"roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag\" -- \"$cur\"))\n      ;;\n    render)\n      case \"$prev\" in\n        --format) COMPREPLY=($(compgen -W \"svg svg-layered svg-sprite html jsx tsx vue svelte data-uri css-background css-mask pdf ai eps png jpg webp avif ico favicon psd figma spec-json\" -- \"$cur\")); return ;;\n        --size) return ;;\n        --out) COMPREPLY=($(compgen -f -- \"$cur\")); return ;;\n        --color) return ;;\n        --stroke-width) return ;;\n        --fill) return ;;\n        --fill-opacity) return ;;\n        --stroke-opacity) return ;;\n        --linecap) COMPREPLY=($(compgen -W \"round butt square\" -- \"$cur\")); return ;;\n        --linejoin) COMPREPLY=($(compgen -W \"round miter bevel\" -- \"$cur\")); return ;;\n        --dot-scale) return ;;\n        --rotation) return ;;\n        --padding) return ;;\n        --background) return ;;\n        --layer-color) return ;;\n        --title) return ;;\n        --param) return ;;\n        --current-color) return ;;\n        --matte) return ;;\n        --quality) return ;;\n      esac\n      if [[ $cur == -* ]]; then COMPREPLY=($(compgen -W \"--format --size --layered --out --color --stroke-width --absolute-stroke-width --fill --fill-opacity --stroke-opacity --linecap --linejoin --dot-scale --rotation --flip-x --flip-y --padding --background --layer-color --title --param --current-color --matte --quality --force --help\" -- \"$cur\")); return; fi\n      COMPREPLY=($(compgen -W \"roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag\" -- \"$cur\"))\n      ;;\n    export)\n      case \"$prev\" in\n        --format) COMPREPLY=($(compgen -W \"svg svg-layered svg-sprite html jsx tsx vue svelte data-uri css-background css-mask pdf ai eps png jpg webp avif ico favicon psd figma spec-json\" -- \"$cur\")); return ;;\n        --sizes) return ;;\n        --out) COMPREPLY=($(compgen -d -- \"$cur\")); return ;;\n        --color) return ;;\n        --stroke-width) return ;;\n        --fill) return ;;\n        --fill-opacity) return ;;\n        --stroke-opacity) return ;;\n        --linecap) COMPREPLY=($(compgen -W \"round butt square\" -- \"$cur\")); return ;;\n        --linejoin) COMPREPLY=($(compgen -W \"round miter bevel\" -- \"$cur\")); return ;;\n        --dot-scale) return ;;\n        --rotation) return ;;\n        --padding) return ;;\n        --background) return ;;\n        --layer-color) return ;;\n        --title) return ;;\n        --param) return ;;\n        --current-color) return ;;\n        --matte) return ;;\n        --quality) return ;;\n      esac\n      if [[ $cur == -* ]]; then COMPREPLY=($(compgen -W \"--all --format --sizes --out --color --stroke-width --absolute-stroke-width --fill --fill-opacity --stroke-opacity --linecap --linejoin --dot-scale --rotation --flip-x --flip-y --padding --background --layer-color --title --param --current-color --matte --quality --force --help\" -- \"$cur\")); return; fi\n      COMPREPLY=($(compgen -W \"roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag\" -- \"$cur\"))\n      ;;\n    flag)\n      case \"$prev\" in\n        --variant) COMPREPLY=($(compgen -W \"full-color mono-black mono-white outline high-contrast square\" -- \"$cur\")); return ;;\n        --width) return ;;\n        --format) COMPREPLY=($(compgen -W \"svg png jpg webp\" -- \"$cur\")); return ;;\n        --title) return ;;\n        --current-color) return ;;\n        --matte) return ;;\n        --quality) return ;;\n        --out) COMPREPLY=($(compgen -f -- \"$cur\")); return ;;\n      esac\n      if [[ $cur == -* ]]; then COMPREPLY=($(compgen -W \"--variant --width --format --title --current-color --matte --quality --out --force --help\" -- \"$cur\")); return; fi\n      ;;\n    validate)\n      if [[ $cur == -* ]]; then COMPREPLY=($(compgen -W \"--help\" -- \"$cur\")); return; fi\n      COMPREPLY=($(compgen -f -- \"$cur\"))\n      ;;\n    completion)\n      if [[ $cur == -* ]]; then COMPREPLY=($(compgen -W \"--help\" -- \"$cur\")); return; fi\n      COMPREPLY=($(compgen -W \"bash zsh fish powershell\" -- \"$cur\"))\n      ;;\n  esac\n}\ncomplete -F _deq deq\n",
    "zsh": "#compdef deq\n# zsh completion for deq. Generated from spec/cli.json; do not edit.\n# Install: deq completion zsh > \"${fpath[1]}/_deq\"\n_deq() {\n  local -a commands\n  commands=(\n    'list:List the shapes in the catalog'\n    'info:Show a shape'\\''s names, layers and parameters'\n    'render:Render shapes to files'\n    'export:Export shapes in several formats and sizes'\n    'flag:Draw the flag of Kurdistan'\n    'validate:Check a shape spec file and render every parameter variant'\n    'completion:Print a shell completion script'\n  )\n  if (( CURRENT == 2 )); then\n    _describe -t commands 'deq command' commands\n    _arguments '(- *)'{-h,--help}'[Show help]' '(- *)'{-V,--version}'[Print the version]'\n    return\n  fi\n  local cmd=${words[2]}\n  shift words\n  (( CURRENT-- ))\n  case $cmd in\n    list)\n      _arguments -S \\\n        '--category[Only shapes in this category]:id: ' \\\n        '--json[Print JSON]' \\\n        '(- *)--help[Show help.]'\n      ;;\n    info)\n      _arguments -S \\\n        '--json[Print JSON]' \\\n        '(- *)--help[Show help.]' \\\n        ':shape:(roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag)'\n      ;;\n    render)\n      _arguments -S \\\n        '--format[Output format]:format:(svg svg-layered svg-sprite html jsx tsx vue svelte data-uri css-background css-mask pdf ai eps png jpg webp avif ico favicon psd figma spec-json)' \\\n        '--size[Width and height in px, 1 to 8192]:px: ' \\\n        '--layered[SVG with one Inkscape layer per shape layer (same as --format svg-layered)]' \\\n        '--out[Output file, or a directory for several files; - writes one file to stdout]:path:_files' \\\n        '--color[Stroke and dot colour (any CSS colour)]:color: ' \\\n        '--stroke-width[Stroke width in grid units, 0.05 to 12]:n: ' \\\n        '--absolute-stroke-width[Keep the stroke the same width in px at any size]' \\\n        '--fill[Fill for closed outlines, or none]:color: ' \\\n        '--fill-opacity[Opacity of the fill]:0-1: ' \\\n        '--stroke-opacity[Opacity of strokes and dots]:0-1: ' \\\n        '--linecap[Line ends]:linecap:(round butt square)' \\\n        '--linejoin[Line corners]:linejoin:(round miter bevel)' \\\n        '--dot-scale[Multiply every dot radius, 0.1 to 4]:n: ' \\\n        '--rotation[Rotate clockwise about the centre]:deg: ' \\\n        '--flip-x[Mirror left to right]' \\\n        '--flip-y[Mirror top to bottom]' \\\n        '--padding[Space around the 24 x 24 canvas in grid units, 0 to 24]:n: ' \\\n        '--background[Background colour, or none]:color: ' \\\n        '*--layer-color[Colour of one layer, for example sun=#FEBD11 (repeatable)]:layer=color: ' \\\n        '--title[Accessible title]:text: ' \\\n        '*--param[Shape parameter, for example rays=9 (repeatable; see deq info)]:name=value: ' \\\n        '--current-color[What currentColor means in PDF and image formats]:color: ' \\\n        '--matte[JPG background behind transparent pixels]:color: ' \\\n        '--quality[JPG and WebP quality]:0-100: ' \\\n        '--force[Overwrite existing files]' \\\n        '(- *)--help[Show help.]' \\\n        '*:shape:(roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag)'\n      ;;\n    export)\n      _arguments -S \\\n        '--all[Export every shape in the catalog]' \\\n        '--format[Comma-separated formats]:list:(svg svg-layered svg-sprite html jsx tsx vue svelte data-uri css-background css-mask pdf ai eps png jpg webp avif ico favicon psd figma spec-json)' \\\n        '--sizes[Comma-separated sizes in px]:list: ' \\\n        '--out[Output directory; files go to <dir>/<format>/<size>/]:dir:_files -/' \\\n        '--color[Stroke and dot colour (any CSS colour)]:color: ' \\\n        '--stroke-width[Stroke width in grid units, 0.05 to 12]:n: ' \\\n        '--absolute-stroke-width[Keep the stroke the same width in px at any size]' \\\n        '--fill[Fill for closed outlines, or none]:color: ' \\\n        '--fill-opacity[Opacity of the fill]:0-1: ' \\\n        '--stroke-opacity[Opacity of strokes and dots]:0-1: ' \\\n        '--linecap[Line ends]:linecap:(round butt square)' \\\n        '--linejoin[Line corners]:linejoin:(round miter bevel)' \\\n        '--dot-scale[Multiply every dot radius, 0.1 to 4]:n: ' \\\n        '--rotation[Rotate clockwise about the centre]:deg: ' \\\n        '--flip-x[Mirror left to right]' \\\n        '--flip-y[Mirror top to bottom]' \\\n        '--padding[Space around the 24 x 24 canvas in grid units, 0 to 24]:n: ' \\\n        '--background[Background colour, or none]:color: ' \\\n        '*--layer-color[Colour of one layer, for example sun=#FEBD11 (repeatable)]:layer=color: ' \\\n        '--title[Accessible title]:text: ' \\\n        '*--param[Shape parameter, for example rays=9 (repeatable; see deq info)]:name=value: ' \\\n        '--current-color[What currentColor means in PDF and image formats]:color: ' \\\n        '--matte[JPG background behind transparent pixels]:color: ' \\\n        '--quality[JPG and WebP quality]:0-100: ' \\\n        '--force[Overwrite existing files]' \\\n        '(- *)--help[Show help.]' \\\n        '*:shape:(roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag)'\n      ;;\n    flag)\n      _arguments -S \\\n        '--variant[Flag variant]:variant:(full-color mono-black mono-white outline high-contrast square)' \\\n        '--width[Width in px, 1 to 8192; the height follows]:px: ' \\\n        '--format[Output format]:format:(svg png jpg webp)' \\\n        '--title[Accessible title]:text: ' \\\n        '--current-color[What currentColor means in image formats]:color: ' \\\n        '--matte[JPG background behind transparent pixels]:color: ' \\\n        '--quality[JPG and WebP quality]:0-100: ' \\\n        '--out[Output file or directory; - writes to stdout]:path:_files' \\\n        '--force[Overwrite existing files]' \\\n        '(- *)--help[Show help.]'\n      ;;\n    validate)\n      _arguments -S \\\n        '(- *)--help[Show help.]' \\\n        ':file:_files'\n      ;;\n    completion)\n      _arguments -S \\\n        '(- *)--help[Show help.]' \\\n        ':shell:(bash zsh fish powershell)'\n      ;;\n  esac\n}\n_deq \"$@\"\n",
    "fish": "# fish completion for deq. Generated from spec/cli.json; do not edit.\n# Install: deq completion fish > ~/.config/fish/completions/deq.fish\ncomplete -c deq -f\ncomplete -c deq -n __fish_use_subcommand -a list -d 'List the shapes in the catalog'\ncomplete -c deq -n __fish_use_subcommand -a info -d 'Show a shape\\'s names, layers and parameters'\ncomplete -c deq -n __fish_use_subcommand -a render -d 'Render shapes to files'\ncomplete -c deq -n __fish_use_subcommand -a export -d 'Export shapes in several formats and sizes'\ncomplete -c deq -n __fish_use_subcommand -a flag -d 'Draw the flag of Kurdistan'\ncomplete -c deq -n __fish_use_subcommand -a validate -d 'Check a shape spec file and render every parameter variant'\ncomplete -c deq -n __fish_use_subcommand -a completion -d 'Print a shell completion script'\ncomplete -c deq -n __fish_use_subcommand -s h -l help -d 'Show help'\ncomplete -c deq -n __fish_use_subcommand -s V -l version -d 'Print the version'\ncomplete -c deq -n '__fish_seen_subcommand_from list' -l category -x -d 'Only shapes in this category'\ncomplete -c deq -n '__fish_seen_subcommand_from list' -l json -d 'Print JSON'\ncomplete -c deq -n '__fish_seen_subcommand_from list' -l help -d 'Show help'\ncomplete -c deq -n '__fish_seen_subcommand_from info' -l json -d 'Print JSON'\ncomplete -c deq -n '__fish_seen_subcommand_from info' -l help -d 'Show help'\ncomplete -c deq -n '__fish_seen_subcommand_from info' -a 'roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l format -x -a 'svg svg-layered svg-sprite html jsx tsx vue svelte data-uri css-background css-mask pdf ai eps png jpg webp avif ico favicon psd figma spec-json' -d 'Output format'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l size -x -d 'Width and height in px, 1 to 8192'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l layered -d 'SVG with one Inkscape layer per shape layer (same as --format svg-layered)'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l out -r -F -d 'Output file, or a directory for several files; - writes one file to stdout'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l color -x -d 'Stroke and dot colour (any CSS colour)'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l stroke-width -x -d 'Stroke width in grid units, 0.05 to 12'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l absolute-stroke-width -d 'Keep the stroke the same width in px at any size'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l fill -x -d 'Fill for closed outlines, or none'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l fill-opacity -x -d 'Opacity of the fill'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l stroke-opacity -x -d 'Opacity of strokes and dots'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l linecap -x -a 'round butt square' -d 'Line ends'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l linejoin -x -a 'round miter bevel' -d 'Line corners'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l dot-scale -x -d 'Multiply every dot radius, 0.1 to 4'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l rotation -x -d 'Rotate clockwise about the centre'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l flip-x -d 'Mirror left to right'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l flip-y -d 'Mirror top to bottom'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l padding -x -d 'Space around the 24 x 24 canvas in grid units, 0 to 24'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l background -x -d 'Background colour, or none'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l layer-color -x -d 'Colour of one layer, for example sun=#FEBD11 (repeatable)'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l title -x -d 'Accessible title'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l param -x -d 'Shape parameter, for example rays=9 (repeatable; see deq info)'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l current-color -x -d 'What currentColor means in PDF and image formats'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l matte -x -d 'JPG background behind transparent pixels'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l quality -x -d 'JPG and WebP quality'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l force -d 'Overwrite existing files'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -l help -d 'Show help'\ncomplete -c deq -n '__fish_seen_subcommand_from render' -a 'roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l all -d 'Export every shape in the catalog'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l format -x -a 'svg svg-layered svg-sprite html jsx tsx vue svelte data-uri css-background css-mask pdf ai eps png jpg webp avif ico favicon psd figma spec-json' -d 'Comma-separated formats'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l sizes -x -d 'Comma-separated sizes in px'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l out -r -F -d 'Output directory; files go to <dir>/<format>/<size>/'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l color -x -d 'Stroke and dot colour (any CSS colour)'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l stroke-width -x -d 'Stroke width in grid units, 0.05 to 12'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l absolute-stroke-width -d 'Keep the stroke the same width in px at any size'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l fill -x -d 'Fill for closed outlines, or none'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l fill-opacity -x -d 'Opacity of the fill'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l stroke-opacity -x -d 'Opacity of strokes and dots'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l linecap -x -a 'round butt square' -d 'Line ends'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l linejoin -x -a 'round miter bevel' -d 'Line corners'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l dot-scale -x -d 'Multiply every dot radius, 0.1 to 4'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l rotation -x -d 'Rotate clockwise about the centre'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l flip-x -d 'Mirror left to right'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l flip-y -d 'Mirror top to bottom'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l padding -x -d 'Space around the 24 x 24 canvas in grid units, 0 to 24'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l background -x -d 'Background colour, or none'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l layer-color -x -d 'Colour of one layer, for example sun=#FEBD11 (repeatable)'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l title -x -d 'Accessible title'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l param -x -d 'Shape parameter, for example rays=9 (repeatable; see deq info)'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l current-color -x -d 'What currentColor means in PDF and image formats'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l matte -x -d 'JPG background behind transparent pixels'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l quality -x -d 'JPG and WebP quality'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l force -d 'Overwrite existing files'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -l help -d 'Show help'\ncomplete -c deq -n '__fish_seen_subcommand_from export' -a 'roj-half-sun roj-sun-circle heyv-crescent sterk-star cup-rays moon-dome star-dense star-flower sun-arch-dotted sun-bar sun-dome-comb sun-double-ring sun-forked-rays sun-rays sun-spiral tree-branch wheat-arrow fork spike ring-stem arrow-down arrow-herringbone arrow-line crow-foot cup dome-stem fork-cross fork-down-dotted fork-down root tree-comb tree-cup trefoil cross cross-dotted x-mark lozenge lozenge-nested triangle-dotted chevron chevron-stack crossed-chevrons comb ladder spindle dimlich arch-dot cross-forked-dotted cross-forked crossed-chevrons-wide dome-comb star-chain t-mark tent-cross tent-double tent tree-row x-chain x-comb dot dot-trio dot-row dot-quincunx dot-rosette dot-cluster chain dot-diamond dot-flower ring-chain-shaft ring-stem-double ring zigzag arrow-row band-border comb-dotted comb-forked comb-x fork-pair tick-bar gazelle fish sandgrouse-foot doll darek arch-dot-column bird dancer chin-composition forehead-composition circle-over-comb drower-union kurdish-sun kurdish-flag'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l variant -x -a 'full-color mono-black mono-white outline high-contrast square' -d 'Flag variant'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l width -x -d 'Width in px, 1 to 8192; the height follows'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l format -x -a 'svg png jpg webp' -d 'Output format'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l title -x -d 'Accessible title'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l current-color -x -d 'What currentColor means in image formats'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l matte -x -d 'JPG background behind transparent pixels'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l quality -x -d 'JPG and WebP quality'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l out -r -F -d 'Output file or directory; - writes to stdout'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l force -d 'Overwrite existing files'\ncomplete -c deq -n '__fish_seen_subcommand_from flag' -l help -d 'Show help'\ncomplete -c deq -n '__fish_seen_subcommand_from validate' -l help -d 'Show help'\ncomplete -c deq -n '__fish_seen_subcommand_from validate' -F\ncomplete -c deq -n '__fish_seen_subcommand_from completion' -l help -d 'Show help'\ncomplete -c deq -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish powershell'\n",
    "powershell": "# PowerShell completion for deq. Generated from spec/cli.json; do not edit.\n# Install: deq completion powershell | Out-String | Invoke-Expression\nRegister-ArgumentCompleter -Native -CommandName deq -ScriptBlock {\n    param($wordToComplete, $commandAst, $cursorPosition)\n    $shapes = @('roj-half-sun', 'roj-sun-circle', 'heyv-crescent', 'sterk-star', 'cup-rays', 'moon-dome', 'star-dense', 'star-flower', 'sun-arch-dotted', 'sun-bar', 'sun-dome-comb', 'sun-double-ring', 'sun-forked-rays', 'sun-rays', 'sun-spiral', 'tree-branch', 'wheat-arrow', 'fork', 'spike', 'ring-stem', 'arrow-down', 'arrow-herringbone', 'arrow-line', 'crow-foot', 'cup', 'dome-stem', 'fork-cross', 'fork-down-dotted', 'fork-down', 'root', 'tree-comb', 'tree-cup', 'trefoil', 'cross', 'cross-dotted', 'x-mark', 'lozenge', 'lozenge-nested', 'triangle-dotted', 'chevron', 'chevron-stack', 'crossed-chevrons', 'comb', 'ladder', 'spindle', 'dimlich', 'arch-dot', 'cross-forked-dotted', 'cross-forked', 'crossed-chevrons-wide', 'dome-comb', 'star-chain', 't-mark', 'tent-cross', 'tent-double', 'tent', 'tree-row', 'x-chain', 'x-comb', 'dot', 'dot-trio', 'dot-row', 'dot-quincunx', 'dot-rosette', 'dot-cluster', 'chain', 'dot-diamond', 'dot-flower', 'ring-chain-shaft', 'ring-stem-double', 'ring', 'zigzag', 'arrow-row', 'band-border', 'comb-dotted', 'comb-forked', 'comb-x', 'fork-pair', 'tick-bar', 'gazelle', 'fish', 'sandgrouse-foot', 'doll', 'darek', 'arch-dot-column', 'bird', 'dancer', 'chin-composition', 'forehead-composition', 'circle-over-comb', 'drower-union', 'kurdish-sun', 'kurdish-flag')\n    $commands = [ordered]@{\n        'list' = @{\n            Flags = @('--category', '--json', '--help')\n            Values = @{ '--category' = @() }\n            Args = @()\n        }\n        'info' = @{\n            Flags = @('--json', '--help')\n            Values = @{  }\n            Args = $shapes\n        }\n        'render' = @{\n            Flags = @('--format', '--size', '--layered', '--out', '--color', '--stroke-width', '--absolute-stroke-width', '--fill', '--fill-opacity', '--stroke-opacity', '--linecap', '--linejoin', '--dot-scale', '--rotation', '--flip-x', '--flip-y', '--padding', '--background', '--layer-color', '--title', '--param', '--current-color', '--matte', '--quality', '--force', '--help')\n            Values = @{ '--format' = @('svg', 'svg-layered', 'svg-sprite', 'html', 'jsx', 'tsx', 'vue', 'svelte', 'data-uri', 'css-background', 'css-mask', 'pdf', 'ai', 'eps', 'png', 'jpg', 'webp', 'avif', 'ico', 'favicon', 'psd', 'figma', 'spec-json'); '--size' = @(); '--out' = @(); '--color' = @(); '--stroke-width' = @(); '--fill' = @(); '--fill-opacity' = @(); '--stroke-opacity' = @(); '--linecap' = @('round', 'butt', 'square'); '--linejoin' = @('round', 'miter', 'bevel'); '--dot-scale' = @(); '--rotation' = @(); '--padding' = @(); '--background' = @(); '--layer-color' = @(); '--title' = @(); '--param' = @(); '--current-color' = @(); '--matte' = @(); '--quality' = @() }\n            Args = $shapes\n        }\n        'export' = @{\n            Flags = @('--all', '--format', '--sizes', '--out', '--color', '--stroke-width', '--absolute-stroke-width', '--fill', '--fill-opacity', '--stroke-opacity', '--linecap', '--linejoin', '--dot-scale', '--rotation', '--flip-x', '--flip-y', '--padding', '--background', '--layer-color', '--title', '--param', '--current-color', '--matte', '--quality', '--force', '--help')\n            Values = @{ '--format' = @('svg', 'svg-layered', 'svg-sprite', 'html', 'jsx', 'tsx', 'vue', 'svelte', 'data-uri', 'css-background', 'css-mask', 'pdf', 'ai', 'eps', 'png', 'jpg', 'webp', 'avif', 'ico', 'favicon', 'psd', 'figma', 'spec-json'); '--sizes' = @(); '--out' = @(); '--color' = @(); '--stroke-width' = @(); '--fill' = @(); '--fill-opacity' = @(); '--stroke-opacity' = @(); '--linecap' = @('round', 'butt', 'square'); '--linejoin' = @('round', 'miter', 'bevel'); '--dot-scale' = @(); '--rotation' = @(); '--padding' = @(); '--background' = @(); '--layer-color' = @(); '--title' = @(); '--param' = @(); '--current-color' = @(); '--matte' = @(); '--quality' = @() }\n            Args = $shapes\n        }\n        'flag' = @{\n            Flags = @('--variant', '--width', '--format', '--title', '--current-color', '--matte', '--quality', '--out', '--force', '--help')\n            Values = @{ '--variant' = @('full-color', 'mono-black', 'mono-white', 'outline', 'high-contrast', 'square'); '--width' = @(); '--format' = @('svg', 'png', 'jpg', 'webp'); '--title' = @(); '--current-color' = @(); '--matte' = @(); '--quality' = @(); '--out' = @() }\n            Args = @()\n        }\n        'validate' = @{\n            Flags = @('--help')\n            Values = @{  }\n            Args = @()\n        }\n        'completion' = @{\n            Flags = @('--help')\n            Values = @{  }\n            Args = @('bash', 'zsh', 'fish', 'powershell')\n        }\n    }\n    $before = @($commandAst.CommandElements | Where-Object { $_.Extent.EndOffset -lt $cursorPosition } | ForEach-Object { $_.ToString() })\n    $candidates = @()\n    if ($before.Count -le 1) {\n        $candidates = @($commands.Keys) + @('--help', '--version')\n    } elseif ($commands.Contains($before[1])) {\n        $spec = $commands[$before[1]]\n        $prev = $before[-1]\n        if ($spec.Values.ContainsKey($prev)) { $candidates = $spec.Values[$prev] }\n        elseif ($wordToComplete.StartsWith('-')) { $candidates = $spec.Flags }\n        else { $candidates = $spec.Args }\n    }\n    $candidates | Where-Object { $_ -like \"$wordToComplete*\" } | ForEach-Object {\n        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)\n    }\n}\n"
  }
};
