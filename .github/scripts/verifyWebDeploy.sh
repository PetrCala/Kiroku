#!/usr/bin/env bash
# Confirms the live Firebase-hosted web app is serving the build we just deployed,
# by matching the content-hashed entry bundle referenced in the live index.html
# against the one in the local dist/ (the build that was just uploaded).
#
# Usage: verifyWebDeploy.sh <host-url> [dist-index-path]
#   <host-url>        e.g. https://app.kiroku.cz
#   [dist-index-path] defaults to dist/index.html
set -euo pipefail

HOST="${1:?usage: verifyWebDeploy.sh <host-url> [dist-index-path]}"
DIST_INDEX="${2:-dist/index.html}"

# Entry bundle name, e.g. main-13d0a5b11e3669b71d70.bundle.js (contenthash, hex).
EXPECTED_BUNDLE="$(grep -oE 'main-[0-9a-f]+\.bundle\.js' "$DIST_INDEX" | head -1 || true)"
if [[ -z "$EXPECTED_BUNDLE" ]]; then
  echo "::error::No main-<hash>.bundle.js found in $DIST_INDEX"
  exit 1
fi
echo "Expecting $HOST to serve: $EXPECTED_BUNDLE"

readonly MAX_ATTEMPTS=12
readonly SLEEP_SECONDS=5
sleep "$SLEEP_SECONDS" # give Firebase's CDN a moment to propagate

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  # Cache-bust so we read the freshly deployed shell, not an edge-cached copy.
  LIVE_INDEX="$(curl -fsSL -H 'Cache-Control: no-cache' "$HOST/?cacheBust=$RANDOM$attempt" 2>/dev/null || true)"
  LIVE_BUNDLE="$(printf '%s' "$LIVE_INDEX" | grep -oE 'main-[0-9a-f]+\.bundle\.js' | head -1 || true)"

  if [[ "$LIVE_BUNDLE" == "$EXPECTED_BUNDLE" ]] && curl -fsSL -o /dev/null "$HOST/$EXPECTED_BUNDLE"; then
    echo "✅ Verified: $HOST is serving $EXPECTED_BUNDLE"
    exit 0
  fi
  echo "attempt $attempt/$MAX_ATTEMPTS: live='${LIVE_BUNDLE:-<none>}' expected='$EXPECTED_BUNDLE'"
  sleep "$SLEEP_SECONDS"
done

echo "::error::Deploy verification failed: $HOST never served $EXPECTED_BUNDLE after $MAX_ATTEMPTS attempts (~$((MAX_ATTEMPTS * SLEEP_SECONDS))s)"
exit 1
