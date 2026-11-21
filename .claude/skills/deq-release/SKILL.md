---
name: deq-release
description: Gitflow, commit, versioning, changelog and release procedure for Deq. Use when branching, committing, opening PRs, or cutting a release.
---

# Deq release and git workflow

## Branches

- `main`: released code, protected. `develop`: integration, protected.
- New work: `git switch develop && git pull && git switch -c feature/<phase-or-topic>-<slug>`.
- PR into `develop`; CI must pass; squash-merge.
- Release: `release/x.y.z` off `develop` → bump the unified version, regenerate files that embed it (`pnpm --filter @0xdolan/deq-cli generate`, `just api-docs`), finalise `CHANGELOG.md` → PR into `main` (merge commit) → annotated tag `vX.Y.Z` on `main` → merge `main` back into `develop`.
- Release artifacts: run `just fonts-check` on the tag and attach `deq-fonts-<version>.zip` (everything in `fonts/dist/` plus `fonts/LICENSE.md`) to the GitHub release. The font version comes from the root `package.json` (1.2.3 → 1.002).
- Website: `.github/workflows/pages.yml` deploys `develop` as a preview while the repository variable `PAGES_PRODUCTION` is not `true`, and every published release to production. After the first release, ask the owner to set `PAGES_PRODUCTION=true`.
- Hotfix: `hotfix/x.y.z` off `main` → PR into `main` → tag → merge into `develop`.

## Commits

- Conventional Commits: `type(scope): summary`. Scopes: core, icons, react, vue, svelte, elements, exporters, generator, cli, python, rust, fonts, site, studio, spec, docs, ci, deps.
- Author is the configured git identity (0xdolan). Never add AI attribution or co-author trailers; commitlint rejects them.

## Versioning

- One SemVer version shared by all npm, PyPI and crates.io packages, fonts and assets. Pre-releases: `-alpha.N`, `-beta.N`, `-rc.N`.
- Update `CHANGELOG.md` (Keep a Changelog) under `[Unreleased]` in every PR.

## Permissions

- Pushing branches and opening PRs is allowed.
- Ask the owner before: force-push, deleting branches or tags, publishing to registries, changing branch protection or visibility.
