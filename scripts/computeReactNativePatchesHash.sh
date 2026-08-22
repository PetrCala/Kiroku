#!/bin/bash
#
# Prints a short, stable hash of every patch that can change the compiled
# React Native Android artifacts (`react-android`).
#
# The hash is the identity of the prebuilt AARs: it is baked into the published
# Maven version (`<rnVersion>-<hash>`), so editing, adding or removing any
# React Native patch changes the coordinates the app asks for. If nobody has
# published artifacts for the new hash, the Android build fails loudly instead
# of silently shipping unpatched React Native.
#
# Only `react-native` and `@react-native/*` patches are hashed. Patches for
# other packages cannot end up inside the `react-android` AAR.
#
# Usage: scripts/computeReactNativePatchesHash.sh [patches-dir]

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
readonly SCRIPT_DIR

PATCHES_DIR="${1:-$SCRIPT_DIR/../patches}"
readonly PATCHES_DIR

if [ ! -d "$PATCHES_DIR" ]; then
  echo "Patches directory not found: $PATCHES_DIR" >&2
  exit 1
fi

# Length of the hash used in artifact versions. Long enough that a collision is
# not a practical concern, short enough to stay readable in Maven coordinates.
readonly HASH_LENGTH=12

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum
  else
    shasum -a 256
  fi
}

# Hash every relevant patch, print "<filename> <hash>" so the result does not
# depend on where the repo lives on disk, sort for a stable order, then hash
# the whole list. An empty patch set still produces a valid (constant) hash.
PATCHES_HASH="$(
  find "$PATCHES_DIR" -type f \( -name 'react-native+*.patch' -o -name '@react-native+*.patch' \) -print0 |
    while IFS= read -r -d '' patch_file; do
      printf '%s %s\n' "$(basename "$patch_file")" "$(sha256 <"$patch_file" | awk '{print $1}')"
    done |
    LC_ALL=C sort |
    sha256 |
    awk '{print $1}'
)"
readonly PATCHES_HASH

echo "${PATCHES_HASH:0:$HASH_LENGTH}"
