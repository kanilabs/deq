# 24. Packaging and release

- Status: accepted
- Date: 2026-11-21

## Context

Phase 13 publishes Deq for the first time: nine npm packages, one PyPI package, two crates, the fonts, the CLI as a binary and as Debian packages, and the website from `main`. Until now every manifest said `0.0.0` and releases were described as manual steps. A release has to be repeatable, signed and traceable to its source, and no registry token should outlive the first upload.

## Decision

- **One version, many spellings.** `scripts/version.ts` writes the SemVer version into every `package.json`, `Cargo.toml` (including the exact `=x.y.z` requirement of `deq-cli` on `deq-shapes`), `pyproject.toml` (PEP 440: `1.0.0rc1`), `__version__` and the Rust install lines, and `--check` fails when they disagree. `just version` also refreshes the lock files and regenerates the help texts, CLI fixtures, man page and API references. Pre-releases are limited to `alpha`, `beta` and `rc`, which every registry orders the same way. The first release is `1.0.0-rc.1`, then `1.0.0`.
- **The tag drives the release.** `.github/workflows/release.yml` runs on a `v*` tag and checks that the tag is annotated, signed (GPG or SSH), equal to `v` plus the version and an ancestor of `main`, and that `CHANGELOG.md` has a section for it (`scripts/release-notes.ts`, which also writes the release notes). Run by hand on any branch it is a dry run: every build, test, lintian check, Docker install and registry dry run, and no upload.
- **Trusted publishing.** npm, PyPI and crates.io receive OIDC tokens from the `release` environment; nothing long-lived is stored. npm and crates.io accept a trusted publisher only on a package that exists, so the first release may use `NPM_TOKEN` and `CARGO_REGISTRY_TOKEN` environment secrets, which are deleted afterwards. PyPI uses a pending publisher from the start. npm packages are published from `pnpm pack` tarballs (which replace `workspace:*`) with provenance. Each publish step skips a version that is already on the registry, so a failed run can be restarted.
- **Release workflow hygiene.** Caches are off in every release job (`cache: "false"` on the setup action), because a poisoned cache from another branch could change what is published. Each job gets only the permissions it needs; only the registry and release jobs get `id-token: write`.
- **Debian packages on the GitHub Release.** `deq-cli` is built with cargo-deb 3.8.0 from a static `*-unknown-linux-musl` binary, so it has no library dependencies and installs on any Ubuntu or Debian release (a glibc build from a newer runner would not install on an older LTS). It carries the man page, generated from `spec/cli.json` like the help texts, and the bash, zsh and fish completions. `fonts-deq` (architecture `all`) is assembled with `dpkg-deb` and installs the OTF and TTF fonts under `/usr/share/fonts/`, the code point tables and the shape SVGs under `/usr/share/deq/`. Both build reproducibly from `SOURCE_DATE_EPOCH`, pass `lintian --fail-on warning` (overrides are commented in `packaging/debian/`) and are installed and removed on Ubuntu 24.04 and 26.04 in Docker, images pinned by digest, in CI and in the release. There is no apt repository or PPA; the `.deb` files are attached to the release.
- **Binaries.** The release builds `deq` for Linux (musl, x86_64 and aarch64), macOS (arm64 and x86_64) and Windows (x86_64), each archived with the README, licence, man page and completions.
- **Signing, provenance and SBOM.** Every file goes into `SHA256SUMS`, which is signed keyless with Sigstore (`cosign sign-blob`, bundle `SHA256SUMS.sigstore.json`). GitHub build provenance attestations cover every file listed in `SHA256SUMS`. A CycloneDX SBOM of the npm, PyPI and Cargo dependencies (syft through `anchore/sbom-action`) is attached and attested with the rest.
- **Pages from the release.** A release made with `GITHUB_TOKEN` starts no other workflow, so `pages.yml` is also a reusable workflow that the Release workflow calls after publishing. Its build skips only pushes to `develop` once `PAGES_PRODUCTION` is `true`.

## Consequences

- Cutting a release is `just version`, a pull request into `main` and a signed tag; the owner approves the `release` environment before anything is uploaded.
- The owner configures, once: the `release` environment (required reviewer, tags `v*` only), the PyPI pending publisher, and after the first release the npm and crates.io trusted publishers, deleting the bootstrap tokens. `PAGES_PRODUCTION` is set to `true` after the first release.
- Users can verify any file with `cosign verify-blob` or `gh attestation verify`, and npm packages with `npm audit signatures`.
- The CLI `.deb` is larger than a dynamically linked build, and musl's allocator is slower; neither matters for a command-line tool that renders small SVGs.
- Packaging for Debian or Ubuntu archives, Homebrew, winget or an apt repository is left for later.
