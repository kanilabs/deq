# @0xdolan/deq-elements

<img src="https://kanilabs.github.io/deq/brand/banner.png" width="640" height="160" alt="Deq · دەق: the Dot rosette logo, traditional Kurdish tattoo shapes as an open, parametric design system.">

`<deq-icon>`: the 93 Deq shapes as a custom element for any page or framework. It draws into the light DOM, so CSS `color`, `font-size` and selectors work as usual.

```sh
npm install @0xdolan/deq-elements
```

```html
<script type="module">
  import "@0xdolan/deq-elements/define";
</script>

<deq-icon name="roj-half-sun"></deq-icon>
<deq-icon name="kurdish-sun" size="48" color="#ED2024" stroke-width="1.5"></deq-icon>
<deq-icon name="roj-half-sun" size="3em" label=""></deq-icon>
```

| Attribute               | Default        | Notes                                                  |
| ----------------------- | -------------- | ------------------------------------------------------ |
| `name`                  |                | catalog id                                             |
| `size`                  | `24`           | px number or a CSS length                              |
| `color`                 | `currentColor` | any CSS colour                                         |
| `stroke-width`          | `2`            | grid units on the 24×24 canvas                         |
| `absolute-stroke-width` | off            | boolean attribute                                      |
| `label`                 | English name   | accessible label; `label=""` marks the icon decorative |

An unknown name or an invalid attribute leaves the element empty; `element.update()` throws a `DeqError` with the reason. Set the `icon` property to draw custom `DeqIcon` data. `defineDeqElements("my-icon")` registers another tag name. Importing the package on a server is safe; `define` does nothing there.

Without a bundler, load the self-contained bundle from a CDN (with SRI): see [docs/cdn.md](../../docs/cdn.md).

License: GPL-3.0-or-later. Example app: [`examples/elements`](../../examples/elements).
