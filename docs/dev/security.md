---
title: Security
description: The security rules every change follows, for code, the website and the supply chain, and how to report a problem.
sidebar:
  order: 12
---

Security is a requirement for every change, not a separate phase ([ADR 0004](../decisions/0004-security-baseline.md)). To report a vulnerability, follow [SECURITY.md](../../SECURITY.md) and do not open a public issue.

## Code

- **Strict types:** TypeScript `strict` without `any`, Python `mypy --strict`, Rust clippy with `-D warnings` and `unsafe` forbidden. Rust code never calls `unwrap`, `expect` or `panic`.
- **Validate every outside input** against a schema before using it: command-line arguments, files, URLs, shared designs and shape specs. Errors are typed `DeqError`s.
- **No dynamic code:** never `eval`, `new Function`, or `innerHTML` with data that did not come from the renderer.
- **Imported SVG** is rebuilt from an allowlist (the Studio's `sanitizeSvg` in `svgimport.ts`): geometry elements with checked geometry and paint attributes, no `url(…)`. DOCTYPE and entities are refused; scripts, event handlers, `foreignObject`, links, text and images are dropped; size and node count are capped.
- **Share links** keep their data in the URL fragment, with a length cap, an inflation cap and schema validation (`share.ts`, `parseDoc`).
- **Writing files:** block path traversal and zip-slip, never follow symlinks out of the output folder, and never overwrite without `--force`.

## Website

- A strict Content Security Policy in a `<meta>` tag (GitHub Pages cannot set headers), configured in `apps/site/astro.config.ts` ([ADR 0012](../decisions/0012-website-foundation.md)). Scripts are allowed by hash only; never add `'unsafe-inline'` or `'unsafe-eval'` for scripts. `'wasm-unsafe-eval'` is allowed only on the pages that export rasters (`WASM_PAGES` in `integrations/csp.ts`).
- The Studio never uses `innerHTML` or `{@html}`. Renderer SVG goes through `src/studio/svg.ts`; designs from storage, files or links go through `parseDoc`; custom shapes go through `parseCustomDef`.
- No analytics and no third-party requests. Fonts are self-hosted.
- CDN assets carry Subresource Integrity hashes. Iframes are sandboxed with the fewest permissions, and never get `allow-same-origin` for pages on `kanilabs.github.io`, which share the site's origin ([ADR 0019](../decisions/0019-showcase.md)).

## Supply chain

- Lockfiles are committed, and installs use `--frozen-lockfile`, `--frozen` or `--locked`.
- Dependencies are pinned to exact versions. pnpm refuses versions published less than 7 days ago, and new crates must pass `cargo deny check`. Add a dependency only when the standard library, a platform feature or existing code cannot do the job.
- GitHub Actions are pinned to full commit SHAs with a version comment, workflows start with `permissions: {}`, each job asks only for what it needs, and checkouts use `persist-credentials: false`. `actionlint` and `zizmor` check every workflow.
- Docker images are pinned by digest, downloads are checked against SHA-256 sums, and containers run as non-root.

## Checks

| Check             | Command or workflow                                    |
| ----------------- | ------------------------------------------------------ |
| Secrets           | `just secrets` (gitleaks), also in the pre-commit hook |
| Dependency audits | `just audit`: pnpm audit, pip-audit, cargo-deny        |
| Workflow security | `uv run zizmor --offline .github`, `actionlint`        |
| Code scanning     | the CodeQL and OpenSSF Scorecard workflows             |
| CSP violations    | the website e2e suite fails on any violation           |

`just ci` runs the secret scan and the audits. No secrets, tokens or personal data belong in code, logs or fixtures.
