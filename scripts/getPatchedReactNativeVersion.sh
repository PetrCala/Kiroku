#!/bin/bash
#
# Prints the Maven version of the prebuilt patched React Native artifacts for this checkout:
#
#   <installed react-native version>-<react native patches hash>
#
# Both sides of the mechanism call this script, so the version an Android build asks for and the
# version .github/workflows/publishReactNativeAndroidArtifacts.yml publishes cannot drift apart.
#
# The version comes from node_modules, not from package.json: the artifact has to match the React
# Native that is actually installed, and a range like `^0.81.4` is not a Maven version.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
readonly SCRIPT_DIR

REACT_NATIVE_PACKAGE_JSON="$SCRIPT_DIR/../node_modules/react-native/package.json"
readonly REACT_NATIVE_PACKAGE_JSON

if [ ! -f "$REACT_NATIVE_PACKAGE_JSON" ]; then
  echo "react-native is not installed ($REACT_NATIVE_PACKAGE_JSON not found). Run npm install first." >&2
  exit 1
fi

REACT_NATIVE_VERSION="$(node --print "require('$REACT_NATIVE_PACKAGE_JSON').version")"
readonly REACT_NATIVE_VERSION

PATCHES_HASH="$("$SCRIPT_DIR/computeReactNativePatchesHash.sh")"
readonly PATCHES_HASH

echo "${REACT_NATIVE_VERSION}-${PATCHES_HASH}"
