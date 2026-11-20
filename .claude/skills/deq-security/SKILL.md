---
name: deq-security
description: Security checklist for any code, script, workflow, Dockerfile or dependency change in a Deq project. Use before writing or reviewing code.
---

# Deq security checklist

Apply to every change. Security is a requirement, not a phase.

## Code

- Strict types: TS `strict` with no `any`; Python `mypy --strict`; Rust `clippy -D warnings`, `unsafe` forbidden.
- Validate every external input (CLI arguments, files, URLs, shared designs, spec JSON) against a schema; return typed errors.
- Never use `eval`, `new Function`, or `innerHTML` with untrusted data.
- Imported SVG: rebuild it from an allowlist (the Studio's `sanitizeSvg` in `svgimport.ts`: geometry elements, checked geometry and paint attributes, no `url(…)`; allowlist parser in CLIs). Refuse DOCTYPE and entities, drop scripts, event handlers, `foreignObject`, links, text and images. Cap size and node count. Only the rebuilt tree reaches any parser that does more than read XML.
- Share links carry data only in the URL fragment, with a length cap, an inflation cap and schema validation (`share.ts`, `parseDoc`).
- File output: block path traversal and zip-slip; do not follow symlinks out of the output directory; never overwrite without `--force`.

## Web

- Strict CSP via `<meta>` (GitHub Pages cannot set headers), configured in `apps/site/astro.config.ts` (ADR 0012). `frame-src` only for `youtube-nocookie.com` and `kanilabs.github.io`. Scripts are allowed by hash only: Astro hashes bundled scripts and `integrations/csp.ts` hashes inline ones; never add `'unsafe-inline'` or `'unsafe-eval'` for scripts. `'wasm-unsafe-eval'` is added only to the Studio pages (`WASM_PAGES` in `integrations/csp.ts`) for the raster exporters. `'unsafe-inline'` is allowed in `style-src-attr` only (Starlight's CSS variables). Never put visitor input into inline scripts or markup. The e2e suite fails on any CSP violation. Studio (ADR 0014) never uses `innerHTML` or `{@html}`: renderer SVG goes through `src/studio/svg.ts` (DOMParser `image/svg+xml` + importNode), and every design from storage, files or links goes through `parseDoc` (valibot + core `prepare`). Custom shapes (8c) from IndexedDB, files (≤ 256 KB) or designs go through `parseCustomDef` (valibot, limits, one core render) before use; booleans use paper.js `paper-core` pinned to 0.12.18 and loaded lazily (do not bump it without reviewing the late-2026 releases). Imported SVG will be sanitised with DOMPurify; `'wasm-unsafe-eval'` is only for the Studio page once raster export lands (8d).
- No analytics or third-party requests on the site.
- SRI for any CDN asset; self-host fonts. Iframes are `sandbox`ed with minimum permissions; never `allow-same-origin` for pages on `kanilabs.github.io` (they share the site's origin, ADR 0019).

## Supply chain

- Commit lockfiles; install with `--frozen-lockfile` / `--frozen` / `--locked`.
- Pin exact versions; pnpm `minimumReleaseAge` is 7 days. Add a package to `onlyBuiltDependencies` only if it truly needs install scripts.
- GitHub Actions: pin full commit SHAs with a `# vX.Y.Z` comment; `permissions: {}` at the top level, least privilege per job; `persist-credentials: false`; never `pull_request_target` with untrusted code. Run `actionlint` and `uv run zizmor --offline .github`.
- Docker: pin images by digest; verify downloads with SHA-256; run as non-root; drop capabilities.

## Before you finish

- `just ci` passes (includes gitleaks and audits).
- No secrets, tokens or personal data in code, logs or fixtures.
