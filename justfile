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

# Website end-to-end checks: build with the fonts, then Playwright + axe + offline, then Lighthouse
site: fonts
    DEQ_REQUIRE_FONTS=1 pnpm exec turbo run build --filter=@0xdolan/deq-site
    pnpm --filter @0xdolan/deq-site e2e
    just site-lighthouse

# Lighthouse (every category at least 95) against a background preview of the built site
site-lighthouse:
    #!/usr/bin/env bash
    set -euo pipefail
    cd apps/site
    pnpm exec astro preview --background --port 4321
    trap 'pnpm exec astro preview stop' EXIT
    for _ in $(seq 30); do curl -sf -o /dev/null http://localhost:4321/deq/ && break; sleep 1; done
    pnpm lighthouse

# Build the icon fonts into fonts/dist (checks that the code point table is fresh)
fonts:
    pnpm exec turbo run build --filter=@0xdolan/deq-core
    pnpm --filter @0xdolan/deq-icons font-data fonts/build/geometry.json
    uv run deq-fonts codepoints --check
    uv run deq-fonts build

# Check the fonts with fontbakery (including ots) and install them into a private fontconfig
fonts-check: fonts
    for f in fonts/dist/*.ttf fonts/dist/*.otf; do uv run --group fonts fontbakery check-universal --loglevel WARN --succinct "$f"; done
    uv run deq-fonts install-check

# Build all packages
build:
    pnpm build
    cargo build --workspace --locked
    uv build --all-packages --out-dir target/python-dist --quiet

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
