---
title: Releasing
description: Branches, commit messages, the shared version number, the changelog and the steps of a release.
sidebar:
  order: 11
---

Deq uses Gitflow ([ADR 0005](../decisions/0005-gitflow-and-branch-protection.md)). `main` holds released code and `develop` is where work comes together. Both are protected.

## Everyday work

```sh
git switch develop && git pull
git switch -c feature/<topic>      # or fix/, docs/, chore/
```

Open a pull request into `develop`. CI must pass, and the pull request is squash-merged. Add a line to the `[Unreleased]` section of `CHANGELOG.md` in every pull request ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)).

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): summary`, for example `feat(core): add the dots option`. The usual scopes are `core`, `icons`, `react`, `vue`, `svelte`, `elements`, `exporters`, `generator`, `cli`, `python`, `rust`, `fonts`, `site`, `studio`, `spec`, `docs`, `ci` and `deps`.

The `commit-msg` hook runs commitlint, which also rejects AI attribution lines. Commits are made with your own git identity.

## Versions

Every npm package, the PyPI package, both crates, the fonts and the assets share one [SemVer](https://semver.org/) version. Pre-releases use `-alpha.N`, `-beta.N` and `-rc.N`. The font version is derived from it (1.2.3 becomes 1.002).

## A release

1. Branch `release/x.y.z` off `develop`.
2. Set the new version everywhere it appears (`git grep` the old one): every `package.json`, `pyproject.toml` and `Cargo.toml`, `__version__` in `deq_shapes/__init__.py` and the install lines in the READMEs. Regenerate the files that include it (`pnpm --filter @0xdolan/deq-cli generate`, `just api-docs`), and move the `[Unreleased]` changelog entries under the new version.
3. Open a pull request into `main` and merge it with a merge commit once CI passes.
4. Tag `main` with an annotated tag `vX.Y.Z` and publish a GitHub release for it.
5. Run `just fonts-check` on the tag and attach `deq-fonts-<version>.zip` (everything in `fonts/dist/` plus `fonts/LICENSE.md`) to the release.
6. Merge `main` back into `develop`.

A hotfix branches `hotfix/x.y.z` off `main`, is merged into `main` and tagged, and is then merged into `develop`.

Publishing to npm, PyPI and crates.io, force-pushing, deleting branches or tags and changing repository settings are done only by the owner.

## The website

`.github/workflows/pages.yml` deploys the website to GitHub Pages. While the repository variable `PAGES_PRODUCTION` is not `true`, every push to `develop` deploys a preview. A published release always deploys production. After the first release, `PAGES_PRODUCTION` is set to `true` so that `develop` no longer overwrites it.
