#!/usr/bin/env bash
# Regenerates <OUT_DIR>/Formula/mirror.rb pointing at the just-published
# release, then leaves it staged for the caller to commit.
#
# Called from the publish-homebrew CI job with:
#   TAG=v1.2.3  REPO=owner/repo  [OUT_DIR=path]  bash scripts/render-homebrew-formula.sh
#
# OUT_DIR defaults to `tap` — the checkout path the CI job uses for
# aragon/homebrew-tap. Override it when running locally, e.g.:
#   TAG=v0.15.0 REPO=aragon/evm-mirror OUT_DIR=/tmp/tap \
#     bash scripts/render-homebrew-formula.sh
#
# The script downloads each release binary, computes its sha256, and writes
# the formula. Fails fast if any asset is missing or the checksum can't be
# computed — better to fail than ship a broken formula.

set -euo pipefail

: "${TAG:?must be set, e.g. v0.15.0}"
: "${REPO:?must be set, e.g. aragon/evm-mirror}"
OUT_DIR="${OUT_DIR:-tap}"

VERSION="${TAG#v}"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

# Fetch the sha256 for a given asset filename.
sha_of() {
  local asset="$1"
  local url="${BASE_URL}/${asset}"
  curl -fsSL "$url" | sha256sum | awk '{print $1}'
}

echo "Computing SHAs for ${TAG}..."
SHA_MACOS_AARCH64=$(sha_of "mirror-macos-aarch64.tar.gz")
SHA_MACOS_X86_64=$(sha_of "mirror-macos-x86_64.tar.gz")
SHA_LINUX_AARCH64=$(sha_of "mirror-linux-aarch64.tar.gz")
SHA_LINUX_X86_64=$(sha_of "mirror-linux-x86_64.tar.gz")

OUT="${OUT_DIR}/Formula/mirror.rb"
mkdir -p "$(dirname "$OUT")"

cat > "$OUT" <<RUBY
# This file is regenerated on every tag release by
# aragon/evm-mirror → .github/workflows/ci.yaml → publish-homebrew.
# Do not edit by hand — changes will be overwritten.

class Mirror < Formula
  desc "Verify on-chain EVM contract source against a local snapshot"
  homepage "https://github.com/${REPO}"
  version "${VERSION}"
  license "AGPL-3.0-or-later"

  on_macos do
    on_arm do
      url "${BASE_URL}/mirror-macos-aarch64.tar.gz"
      sha256 "${SHA_MACOS_AARCH64}"
    end
    on_intel do
      url "${BASE_URL}/mirror-macos-x86_64.tar.gz"
      sha256 "${SHA_MACOS_X86_64}"
    end
  end

  on_linux do
    on_arm do
      url "${BASE_URL}/mirror-linux-aarch64.tar.gz"
      sha256 "${SHA_LINUX_AARCH64}"
    end
    on_intel do
      url "${BASE_URL}/mirror-linux-x86_64.tar.gz"
      sha256 "${SHA_LINUX_X86_64}"
    end
  end

  def install
    bin.install "mirror"
  end

  test do
    assert_match "Mirror", shell_output("#{bin}/mirror --version")
  end
end
RUBY

echo "Wrote ${OUT}:"
cat "$OUT"
