import starlight from "@astrojs/starlight";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

import { csp } from "./integrations/csp.ts";
import { docsLinks } from "./integrations/docs-sidebar.ts";
import { fonts } from "./integrations/fonts.ts";
import { media } from "./integrations/media.ts";
import { pwa } from "./integrations/pwa.ts";
import { CATALOGS, LOCALE_INFO, type MessageKey } from "./src/i18n/index.ts";

/** A sidebar label in every locale, from the typed catalogs. */
const label = (key: MessageKey) => ({
  label: CATALOGS.en[key],
  translations: { ckb: CATALOGS.ckb[key], kmr: CATALOGS.kmr[key] },
});

// https://astro.build/config
export default defineConfig({
  site: "https://kanilabs.github.io",
  base: "/deq",
  trailingSlash: "always",
  build: { format: "directory" },
  // Strict CSP as a <meta> tag (GitHub Pages cannot set headers). Astro hashes the
  // scripts and styles it emits; everything else must come from this origin.
  security: {
    csp: {
      algorithm: "SHA-256",
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "manifest-src 'self'",
        "worker-src 'self'",
        "frame-src https://www.youtube-nocookie.com https://kanilabs.github.io",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      // Starlight and Expressive Code set CSS variables in `style` attributes (sidebar
      // depth, icon sizes, code token colours), which hashes cannot cover. Allow inline
      // style *attributes* only; <style> elements stay hash-checked and scripts are
      // untouched (ADR 0012).
      styleDirective: {
        resources: ["'self'", { resource: "'unsafe-inline'", kind: "attribute" }],
      },
    },
  },
  integrations: [
    starlight({
      title: "Deq",
      description: CATALOGS.en["site.description"],
      logo: {
        light: "../../assets/brand/mark-small.svg",
        dark: "../../assets/brand/mark-small-dark.svg",
        alt: "Deq",
      },
      favicon: "/favicon.svg",
      defaultLocale: "root",
      locales: {
        root: { label: LOCALE_INFO.en.label, lang: "en" },
        ckb: { label: LOCALE_INFO.ckb.label, lang: "ckb", dir: "rtl" },
        kmr: { label: LOCALE_INFO.kmr.label, lang: "kmr" },
      },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/kanilabs/deq" }],
      customCss: ["./src/styles/fonts.css", "./src/styles/tokens.css"],
      components: {
        Head: "./src/components/Head.astro",
        Banner: "./src/components/Banner.astro",
        Footer: "./src/components/Footer.astro",
      },
      sidebar: [
        { ...label("nav.home"), link: "/" },
        { ...label("nav.story"), link: "/story/" },
        { ...label("nav.icons"), link: "/icons/" },
        { ...label("nav.studio"), link: "/studio/" },
        { ...label("nav.leet"), link: "/leet/" },
        { ...label("nav.generate"), link: "/generate/" },
        { ...label("nav.flag"), link: "/flag/" },
        { ...label("nav.fonts"), link: "/fonts/" },
        { ...label("nav.brand"), link: "/brand/" },
        { ...label("nav.sources"), link: "/sources/" },
        { ...label("nav.showcase"), link: "/showcase/" },
        { ...label("nav.about"), link: "/about/" },
        {
          ...label("nav.docs"),
          items: [
            { ...label("nav.docs.overview"), link: "/docs/" },
            { ...label("nav.docs.guides"), items: docsLinks("guide") },
            { ...label("nav.docs.dev"), items: docsLinks("dev") },
            { ...label("nav.docs.api"), items: docsLinks("api") },
          ],
        },
      ],
      // Our own 404 page is localised and shares the site layout.
      disable404Route: true,
      lastUpdated: false,
      // Only docs pages get previous and next links, from `src/routeData.ts` (ADR 0020).
      pagination: false,
      routeMiddleware: "./src/routeData.ts",
    }),
    svelte(),
    fonts(),
    media(),
    // After every page is written, before the service worker precaches them.
    csp(),
    pwa(),
  ],
});
