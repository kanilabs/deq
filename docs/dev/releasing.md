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

Every npm package, the PyPI package, both crates, the fonts and the Debian packages share one [SemVer](https://semver.org/) version. Pre-releases use `-alpha.N`, `-beta.N` and `-rc.N`. Each place spells it its own way:

| Where                       | 1.0.0-rc.1 is written as     |
| --------------------------- | ---------------------------- |
| npm, crates.io, git tag     | `1.0.0-rc.1` (`v1.0.0-rc.1`) |
| PyPI (PEP 440)              | `1.0.0rc1`                   |
| Debian                      | `1.0.0~rc.1-1`               |
| Fonts (`head.fontRevision`) | `1.000`                      |

`just version 1.0.0-rc.1` writes the version into every manifest (`scripts/version.ts`), refreshes `Cargo.lock` and `uv.lock`, and regenerates the files that print it: the CLI help and fixtures, the man page and the API references. `node scripts/version.ts --check` fails when two manifests disagree; the unit tests run it too.

## Packages and files

| Channel        | What                                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm            | `@0xdolan/deq-{core,icons,exporters,generator,react,vue,svelte,elements,cli}`, with provenance                                                                                                                                                                               |
| PyPI           | `deq-shapes`                                                                                                                                                                                                                                                                 |
| crates.io      | `deq-shapes`, then `deq-cli`                                                                                                                                                                                                                                                 |
| GitHub Release | `deq` binaries for Linux (static musl, x86_64 and aarch64), macOS (arm64 and x86_64) and Windows (x86_64); `deq-cli` and `fonts-deq` `.deb` packages; the fonts, the icon SVG and PNG packs and the brand kit as ZIPs; `SHA256SUMS` with a Sigstore bundle; a CycloneDX SBOM |

Pre-releases go to the `next` dist-tag on npm and are marked as pre-releases on GitHub; pip and cargo skip them unless asked.

`just deb` builds both Debian packages into `target/deb/` and checks them with lintian; `just deb-test` installs them on Ubuntu 24.04 and 26.04 in Docker. The CLI package holds a static binary, so it has no library dependencies and installs on any release. The man page `packaging/man/deq.1` is generated from `spec/cli.json` with the help texts.

## A release

1. Branch `release/x.y.z` off `develop`.
2. Run `just version x.y.z`, move the `[Unreleased]` changelog entries under `## [x.y.z] - YYYY-MM-DD` and add its link at the bottom.
3. Run the Release workflow by hand on the branch (Actions → Release → Run workflow). Without a tag it is a dry run: it builds and tests everything, installs the `.deb` packages and runs every registry's dry run, and publishes nothing.
4. Open a pull request into `main` and merge it with a merge commit once CI passes.
5. Tag the merge commit with a signed, annotated tag and push it:

   ```sh
   git switch main && git pull
   git tag -s vX.Y.Z -m "Deq X.Y.Z"
   git push origin vX.Y.Z
   ```

6. The tag starts `.github/workflows/release.yml`. It checks that the tag is signed, matches the version and is on `main`, builds every file, publishes to npm, PyPI and crates.io (skipping anything already published, so a failed run can be restarted), creates the GitHub Release with the changelog section as notes, and deploys the website. The registry jobs and the release job wait for approval in the `release` environment.
7. Merge `main` back into `develop`.

A hotfix branches `hotfix/x.y.z` off `main`, is merged into `main` and tagged, and is then merged into `develop`.

Only the owner tags releases, approves the `release` environment, publishes packages, force-pushes, deletes branches or tags and changes repository settings.

## Registry access

The registries trust the Release workflow through OpenID Connect ([trusted publishing](https://docs.npmjs.com/trusted-publishers)), so no long-lived token is stored. Each one is set up once by the owner, naming the repository `kanilabs/deq`, the workflow `release.yml` and the environment `release`:

- **PyPI**: add a pending publisher for `deq-shapes` before the first release.
- **npm** and **crates.io**: trusted publishing is configured on a package that already exists. For the first release only, store a granular `NPM_TOKEN` and a `CARGO_REGISTRY_TOKEN` as secrets of the `release` environment; the workflow uses them when they are set. After the first release, add the trusted publisher to each package and delete both secrets.

npm trusted publishing needs npm 11.5.1 or later, which the workflow checks.

## Checking a release

```sh
# Signature of the checksums (keyless Sigstore, bound to the workflow and tag)
cosign verify-blob SHA256SUMS --bundle SHA256SUMS.sigstore.json \
  --certificate-identity "https://github.com/kanilabs/deq/.github/workflows/release.yml@refs/tags/vX.Y.Z" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
sha256sum -c SHA256SUMS
# Build provenance of one file
gh attestation verify deq-cli_X.Y.Z-1_amd64.deb --repo kanilabs/deq
# npm provenance
npm audit signatures
```

## The website

`.github/workflows/pages.yml` deploys the website to GitHub Pages. While the repository variable `PAGES_PRODUCTION` is not `true`, every push to `develop` deploys a preview. The Release workflow deploys production after it publishes a release. After the first release, `PAGES_PRODUCTION` is set to `true` so that `develop` no longer overwrites it.
