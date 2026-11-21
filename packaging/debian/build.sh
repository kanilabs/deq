#!/usr/bin/env bash
# Builds the Debian packages (ADR 0024) into target/deb/:
#   deq-cli_<version>-1_<arch>.deb   the static Rust `deq` binary, man page and completions (cargo-deb)
#   fonts-deq_<version>-1_all.deb    the icon and Leet fonts, plus the shapes as SVG in /usr/share/deq
# Needs the fonts in fonts/dist (`just fonts`), cargo-deb and dpkg-deb. Run from the repository root,
# or use `just deb`. The version comes from package.json (1.0.0-rc.1 becomes 1.0.0~rc.1-1).
set -euo pipefail
umask 022

version=$(node -p 'require("./package.json").version')
deb_version="${version/-/\~}-1"
out=target/deb
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git log -1 --format=%ct)}"
maintainer="0xdolan <0xdolan@gmail.com>"

for f in DeqIcons-Regular.otf 'DeqIcons[DOTS,wght].ttf' DeqIconsColor-Regular.ttf DeqLeet-Regular.otf \
  codepoints.json leet-codepoints.json; do
  [[ -f "fonts/dist/$f" ]] || { echo "fonts/dist/$f is missing: run just fonts" >&2; exit 1; }
done

rm -rf "$out"
mkdir -p "$out/completions"

# The Debian changelog both packages carry.
changelog() {
  printf '%s (%s) unstable; urgency=medium\n\n  * Deq %s: https://github.com/kanilabs/deq/releases/tag/v%s\n\n -- %s  %s\n' \
    "$1" "$deb_version" "$version" "$version" "$maintainer" "$(date -u -R -d "@$SOURCE_DATE_EPOCH")"
}

# ---------------------------------------------------------------- deq-cli
# A static musl binary, so the package needs no particular glibc and installs on every release.
triple="$(uname -m)-unknown-linux-musl"
rustup target add "$triple" >/dev/null
cargo build --release --locked -p deq-cli --target "$triple"
deq="target/$triple/release/deq"
"$deq" completion bash >"$out/completions/deq"
"$deq" completion zsh >"$out/completions/_deq"
"$deq" completion fish >"$out/completions/deq.fish"
changelog deq-cli >"$out/changelog"
cargo deb -p deq-cli --target "$triple" --no-build --locked --deb-version "$deb_version" --output "$out/"

# ---------------------------------------------------------------- fonts-deq
root="$out/fonts-deq"
doc="$root/usr/share/doc/fonts-deq"
install -d "$root/DEBIAN" "$root/usr/share/fonts/opentype/deq" "$root/usr/share/fonts/truetype/deq" \
  "$root/usr/share/deq" "$doc"
# One file per family: CFF OpenType for the static fonts, TrueType for the variable and colour ones.
install -m 644 fonts/dist/DeqIcons-Regular.otf fonts/dist/DeqLeet-Regular.otf "$root/usr/share/fonts/opentype/deq/"
install -m 644 'fonts/dist/DeqIcons[DOTS,wght].ttf' fonts/dist/DeqIconsColor-Regular.ttf "$root/usr/share/fonts/truetype/deq/"
install -m 644 fonts/dist/codepoints.json fonts/dist/leet-codepoints.json "$root/usr/share/deq/"
"$deq" export --all --format svg --out "$out/icons" --force >/dev/null
install -d "$root/usr/share/deq/icons"
install -m 644 "$out"/icons/svg/24/*.svg "$root/usr/share/deq/icons/"
install -m 644 packaging/debian/copyright-fonts "$doc/copyright"
install -D -m 644 packaging/debian/fonts-deq.lintian-overrides "$root/usr/share/lintian/overrides/fonts-deq"
changelog fonts-deq | gzip -9n >"$doc/changelog.Debian.gz"
chmod 644 "$doc/changelog.Debian.gz"

cat >"$root/DEBIAN/control" <<EOF
Package: fonts-deq
Version: $deb_version
Architecture: all
Multi-Arch: foreign
Maintainer: $maintainer
Installed-Size: $(du -sk --exclude=DEBIAN "$root" | cut -f1)
Section: fonts
Priority: optional
Homepage: https://kanilabs.github.io/deq/
Description: Deq icon and Leet fonts, traditional Kurdish tattoo motifs
 Deq turns traditional Kurdish tattoo (deq) motifs into an open, parametric
 design system. This package installs the Deq Icons fonts (static, variable
 and colour), the monospaced Deq Leet font, and every shape as an SVG file in
 /usr/share/deq/icons with the code point tables in /usr/share/deq.
EOF
(cd "$root" && find usr -type f -print0 | sort -z | xargs -0 md5sum >DEBIAN/md5sums)
chmod 644 "$root/DEBIAN/control" "$root/DEBIAN/md5sums"
find "$root" -exec touch -h -d "@$SOURCE_DATE_EPOCH" {} +
dpkg-deb --root-owner-group -Zxz --build "$root" "$out/fonts-deq_${deb_version}_all.deb" >/dev/null
rm -rf "$root" "$out/icons"

ls -1 "$out"/*.deb
