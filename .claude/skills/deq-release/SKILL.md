---
name: deq-release
description: Gitflow, commit, versioning, changelog and release procedure for Deq. Use when branching, committing, opening PRs, or cutting a release.
---

# Deq release and git workflow

## Branches

- `main`: released code, protected. `develop`: integration, protected.
- New work: `git switch develop && git pull && git switch -c feature/<phase-or-topic>-<slug>`.
- PR into `develop`; CI must pass; squash-merge.
- Release (ADR 0024, guide `docs/dev/releasing.md`): `release/x.y.z` off `develop` → `just version x.y.z` (writes every manifest, PEP 440 for Python, refreshes locks, CLI help/fixtures, man page, API docs) → move `[Unreleased]` under `## [x.y.z] - date` plus its link → PR into `main` (the Release workflow dry-runs on it; merge commit) → the owner pushes a signed annotated tag `vX.Y.Z` → `release.yml` checks tag/version/signature/main, builds binaries, `.deb`, ZIPs, publishes npm/PyPI/crates (skips versions already there), signs `SHA256SUMS` (cosign), attests provenance, attaches the SBOM, creates the GitHub Release (`--prerelease` for `-rc.N`, npm dist-tag `next`) and calls `pages.yml` → merge `main` back into `develop`.
- Registries use trusted publishing from the `release` environment. First npm and crates.io publishes may use the `NPM_TOKEN`/`CARGO_REGISTRY_TOKEN` environment secrets; afterwards the owner adds trusted publishers and deletes them. PyPI uses a pending publisher.
- Debian: `just deb` (cargo-deb 3.8.0 from a static musl binary, `dpkg-deb` for `fonts-deq`, lintian `--fail-on warning`), `just deb-test` (Ubuntu 24.04/26.04 in Docker, digests pinned). Never commit `target/deb/`.
- Release jobs set `cache: "false"` on the setup action (cache poisoning). Keep `node scripts/version.ts --check` and `scripts/test/release.test.ts` green.
- Website: `.github/workflows/pages.yml` deploys `develop` as a preview while the repository variable `PAGES_PRODUCTION` is not `true`, and production when `release.yml` calls it. After the first release, ask the owner to set `PAGES_PRODUCTION=true`.
- Hotfix: `hotfix/x.y.z` off `main` → PR into `main` → tag → merge into `develop`.

## Commits

- Conventional Commits: `type(scope): summary`. Scopes: core, icons, react, vue, svelte, elements, exporters, generator, cli, python, rust, fonts, site, studio, spec, docs, ci, deps.
- Author is the configured git identity (0xdolan). Never add AI attribution or co-author trailers; commitlint rejects them.

## Versioning

- One SemVer version shared by all npm, PyPI and crates.io packages, fonts and assets. Pre-releases: `-alpha.N`, `-beta.N`, `-rc.N`.
- Update `CHANGELOG.md` (Keep a Changelog) under `[Unreleased]` in every PR.

## Permissions

- Pushing branches and opening PRs is allowed.
- Ask the owner before: force-push, deleting branches or tags, pushing release tags, publishing to registries, changing branch protection, environments or visibility.
