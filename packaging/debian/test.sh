#!/usr/bin/env bash
# Installs the packages from target/deb/ on each Ubuntu LTS release in Docker and checks that they
# work: the deq binary, its man page and completions, the fonts in fontconfig and the shape SVGs.
# Run after packaging/debian/build.sh, or use `just deb-test`. Images are pinned by digest.
set -euo pipefail

images=(
  "ubuntu:24.04@sha256:9c7f200c07e3d4a03e7249d2c16bf66a51120fb876aa2242cf31451412543289"
  "ubuntu:26.04@sha256:d66b366dac61b575bee2aef07e9c26e8070096fbe84a3d4d3eb0da069b5d76db"
)
arch=$(dpkg --print-architecture)
shopt -s nullglob
debs=(target/deb/deq-cli_*_"$arch".deb target/deb/fonts-deq_*_all.deb)
[[ ${#debs[@]} -eq 2 ]] || { echo "build the packages first: just deb" >&2; exit 1; }

check='set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends fontconfig /deb/*.deb >/dev/null
deq --version
deq list | grep -q dot-rosette
deq render dot-rosette --out - | grep -q "<svg"
dpkg -L deq-cli | grep -q /usr/share/man/man1/deq.1.gz  # minimal images skip man pages on disk
test -f /usr/share/bash-completion/completions/deq
test -f /usr/share/deq/icons/dot-rosette.svg
fc-list : family | grep -q "Deq Icons"
fc-list : family | grep -q "Deq Leet"
apt-get remove -y -qq deq-cli fonts-deq >/dev/null
test ! -e /usr/bin/deq
echo "installed and removed cleanly"'

for image in "${images[@]}"; do
  echo "== ${image%@*}"
  docker run --rm --network bridge -v "$PWD/target/deb:/deb:ro" "$image" sh -c "$check"
done
