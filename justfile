# Deq task runner. `just ci` runs the same checks as GitHub CI.
set shell := ["bash", "-euo", "pipefail", "-c"]

# List recipes
default:
    @just --list

# Install all dependencies from lockfiles and enable git hooks
setup:
    pnpm install --frozen-lockfile
    uv sync --frozen
    pnpm exec lefthook install

# Run every CI check locally
ci: forbidden lint typecheck test build audit secrets

# Format all code
fmt:
    pnpm format
    uv run ruff format
    uv run ruff check --fix
    cargo fmt --all

# Lint and format checks (TS, Python, Rust, GitHub workflows)
lint:
    pnpm lint
    pnpm format:check
    uv run ruff check
    uv run ruff format --check
    cargo fmt --all --check
    cargo clippy --workspace --all-targets --locked -- -D warnings
    RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps --locked
    actionlint
    uv run zizmor --offline .github

# Type checks
typecheck:
    pnpm typecheck
    uv run mypy

# Unit tests with coverage gates
test:
    pnpm test
    uv run pytest
    uv run deq-assets verify
    uv run deq-spec lint
    cargo test --workspace --locked

# Exporter tests that need Inkscape 1.4+ and Ghostscript (fails if either is missing)
test-tools:
    DEQ_REQUIRE_TOOLS=1 pnpm exec turbo run test --filter=@0xdolan/deq-exporters

# Website end-to-end checks: build with the fonts and story images, check internal links,
# then Playwright + axe + offline, then Lighthouse
site: fonts media
    DEQ_REQUIRE_FONTS=1 DEQ_REQUIRE_MEDIA=1 pnpm exec turbo run build --filter=@0xdolan/deq-site
    pnpm --filter @0xdolan/deq-site links
    pnpm --filter @0xdolan/deq-site e2e
    just site-lighthouse

# Story image variants (AVIF/WebP/JPEG) into the gitignored assets/.generated (ADR 0018)
media:
    uv run --frozen deq-assets variants

# Lighthouse (every category at least 95) against a background preview of the built site
site-lighthouse:
    #!/usr/bin/env bash
    set -euo pipefail
    cd apps/site
    pnpm exec astro preview --background --port 4321
    trap 'pnpm exec astro preview stop' EXIT
    for _ in $(seq 30); do curl -sf -o /dev/null http://localhost:4321/deq/ && break; sleep 1; done
    pnpm lighthouse

# TypeScript and Python API references into docs/api (ADR 0021)
api-docs:
    pnpm build
    node scripts/api-docs.ts
    uv run deq-spec api-docs

# Documentation screenshots into apps/site/public/screens (ADR 0020); pass names to redo some
screenshots *names: fonts media
    #!/usr/bin/env bash
    set -euo pipefail
    DEQ_REQUIRE_FONTS=1 DEQ_REQUIRE_MEDIA=1 pnpm exec turbo run build --filter=@0xdolan/deq-site
    cd apps/site
    pnpm exec astro preview --background --port 4321
    trap 'pnpm exec astro preview stop' EXIT
    for _ in $(seq 30); do curl -sf -o /dev/null http://localhost:4321/deq/ && break; sleep 1; done
    pnpm screenshots {{names}}

# Build the icon and Leet fonts into fonts/dist (checks that the code point tables are fresh)
fonts:
    pnpm exec turbo run build --filter=@0xdolan/deq-core --filter=@0xdolan/deq-generator
    pnpm --filter @0xdolan/deq-icons font-data fonts/build/geometry.json
    pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json
    uv run deq-fonts codepoints --check
    uv run deq-fonts build

# Check the fonts with fontbakery (including ots) and install them into a private fontconfig.
# fontbakery 1.1.0's monospace check crashes on CFF fonts (no glyf table), so the Leet OTF skips it.
fonts-check: fonts
    #!/usr/bin/env bash
    set -euo pipefail
    for f in fonts/dist/*.ttf fonts/dist/*.otf; do
      skip=(); [[ "$f" == *DeqLeet-Regular.otf ]] && skip=(-x opentype/monospace)
      uv run --group fonts fontbakery check-universal --loglevel WARN --succinct "${skip[@]}" "$f"
    done
    uv run deq-fonts install-check

# Build all packages
build:
    pnpm build
    cargo build --workspace --locked
    uv build --all-packages --out-dir target/python-dist --quiet

# Brand SVGs from the Dot rosette, plus PNGs for GitHub and social media (needs Inkscape)
brand:
    uv run deq-spec brand
    mkdir -p assets/.generated/brand
    inkscape assets/brand/social-preview.svg -w 1280 -h 640 -o assets/.generated/brand/social-preview.png
    inkscape assets/brand/logo.svg -w 1024 -h 1024 -o assets/.generated/brand/logo-1024.png
    inkscape assets/brand/logo.svg -w 500 -h 500 -o assets/.generated/brand/logo-500.png

# Dependency audits (npm, PyPI, crates)
audit:
    pnpm audit --audit-level moderate
    uv run pip-audit --skip-editable --progress-spinner off
    cargo deny check

# Scan git history and the working tree for secrets
secrets:
    gitleaks git --redact --no-banner .
    gitleaks dir --redact --no-banner apps packages python rust scripts docs .github spec content assets examples fonts

# Fail if files that must never be committed are tracked or staged
forbidden:
    #!/usr/bin/env bash
    set -euo pipefail
    bad=$( { git ls-files; git diff --cached --name-only; } | grep -E '^(temp/|PRD$|PRD-detailed\.md$)' || true)
    if [[ -n "$bad" ]]; then echo "Forbidden files tracked or staged:"; echo "$bad"; exit 1; fi
    echo "forbidden: ok"

# Run CI in a clean Docker container
docker-ci:
    docker compose run --rm --build ci

# Run the GitHub Actions CI workflow locally with act
act-ci:
    act pull_request -W .github/workflows/ci.yml
