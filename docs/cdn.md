# Deq from a CDN

Every npm release is mirrored by [jsDelivr](https://www.jsdelivr.com/) and [unpkg](https://unpkg.com/). Always pin an exact version and add a Subresource Integrity (`integrity`) hash, so the browser refuses a file that was changed. Replace `VERSION` and `HASH` below.

## `<deq-icon>` without a build step

`@0xdolan/deq-elements/dist/cdn/deq-elements.js` is one self-contained, minified ES module (about 9 kB gzipped) that registers `<deq-icon>`:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@0xdolan/deq-elements@VERSION/dist/cdn/deq-elements.js"
  integrity="HASH"
  crossorigin="anonymous"
></script>

<deq-icon name="roj-half-sun" size="32"></deq-icon>
```

unpkg: `https://unpkg.com/@0xdolan/deq-elements@VERSION/dist/cdn/deq-elements.js`.

## Sprite and SVG files

```html
<!-- load once, then reference symbols -->
<svg width="24" height="24"><use href="#deq-roj-half-sun" /></svg>
```

- Sprite: `https://cdn.jsdelivr.net/npm/@0xdolan/deq-icons@VERSION/dist/sprite.svg`
- One shape: `https://cdn.jsdelivr.net/npm/@0xdolan/deq-icons@VERSION/dist/svg/roj-half-sun.svg`
- Metadata: `https://cdn.jsdelivr.net/npm/@0xdolan/deq-icons@VERSION/dist/icons.json`

Browsers only resolve `<use href="file.svg#id">` on the same origin, so fetch the sprite and inline it, or copy it to your own site. `<img src=".../roj-half-sun.svg">` works across origins.

## Integrity hashes

Each package ships its hashes in `dist/integrity.json` (also exported as `@0xdolan/deq-icons/integrity.json` and `@0xdolan/deq-elements/integrity.json`):

```sh
curl -s https://cdn.jsdelivr.net/npm/@0xdolan/deq-elements@VERSION/dist/integrity.json
```

Or compute one yourself:

```sh
curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A | sed 's/^/sha384-/'
```

Do not use jsDelivr's `/+esm` or minified (`.min.js`) URLs with SRI: jsDelivr generates those files on its side, and they can change.
