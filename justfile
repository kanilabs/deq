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
    just _capture screenshots {{names}}

# PWA store screenshots into apps/site/public/store (ADR 0023); pass names to redo some
store *names: fonts media
    just _capture store {{names}}

# README feature clips (WebM and GIF, needs ffmpeg) into apps/site/public/clips (ADR 0023)
clips *names: fonts media
    just _capture clips {{names}}

# Build the site, start a preview and run one of its capture scripts against it
_capture script *names:
    #!/usr/bin/env bash
    set -euo pipefail
    DEQ_REQUIRE_FONTS=1 DEQ_REQUIRE_MEDIA=1 pnpm exec turbo run build --filter=@0xdolan/deq-site
    cd apps/site
    pnpm exec astro preview --background --port 4321
    trap 'pnpm exec astro preview stop' EXIT
    for _ in $(seq 30); do curl -sf -o /dev/null http://localhost:4321/deq/ && break; sleep 1; done
    pnpm {{script}} {{names}}

# Build the icon and Leet fonts into fonts/dist (checks that the code point tables and the
# site's UI font subset are fresh)
fonts:
    pnpm exec turbo run build --filter=@0xdolan/deq-core --filter=@0xdolan/deq-generator
    pnpm --filter @0xdolan/deq-icons font-data fonts/build/geometry.json
    pnpm --filter @0xdolan/deq-generator font-data fonts/build/leet.json
    uv run deq-fonts codepoints --check
    uv run deq-fonts ui-subset --check
    uv run deq-fonts wordmark --check
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

# Brand SVGs from the Dot rosette and the wordmark outlines; the site builds PNGs and kits
brand:
    uv run deq-fonts wordmark
    uv run deq-spec brand

# The animated logo as MP4 and WebM (needs ffmpeg) into apps/site/public/brand (ADR 0023)
brand-video: brand
    pnpm --filter @0xdolan/deq-site brand-video

# Debian packages deq-cli and fonts-deq into target/deb, checked with lintian (ADR 0024)
deb: fonts
    packaging/debian/build.sh
    lintian --fail-on warning target/deb/*.deb

# Install the Debian packages on each Ubuntu LTS in Docker
deb-test:
    packaging/debian/test.sh

# Set the shared version everywhere (ADR 0024) and regenerate the files that embed it
version v:
    node scripts/version.ts {{v}}
    cargo update --workspace --offline --quiet
    uv lock --quiet
    pnpm --filter @0xdolan/deq-cli generate
    pnpm --filter @0xdolan/deq-cli fixtures
    just api-docs
    node scripts/version.ts --check

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
