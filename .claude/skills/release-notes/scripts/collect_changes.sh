#!/bin/bash
set -euo pipefail

# Resolve a Kiroku public store version to its git commit and list the
# user-relevant commit subjects from that commit up to a target ref.
#
# Usage:
#   collect_changes.sh <from-version> [<to-ref>]
#
#   <from-version> accepts:
#     0.3.13.1   App Store display format (last dot is really a build dash)
#     0.3.13-1   internal package.json format
#     0.3.10     bare minor: resolves to the LAST build of that minor
#   <to-ref> defaults to master.
#
# Resolution order (release tags only exist as X-N-staging and get pruned,
# so commit messages are the durable anchor):
#   1. "chore: release X-N"   (release-please era, ~0.3.11+)
#   2. "Version update: X-N"  (older era, <= ~0.3.11)
#   3. tag "X-N-staging"

FROM_INPUT="${1:?usage: collect_changes.sh <from-version> [<to-ref>]}"
TO_REF="${2:-master}"

cd "$(git rev-parse --show-toplevel)"

# --- Normalize the version string -------------------------------------------
if [[ "$FROM_INPUT" =~ ^([0-9]+\.[0-9]+\.[0-9]+)\.([0-9]+)$ ]]; then
  # App Store display format 0.3.13.1 -> 0.3.13-1
  VERSION="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}"
elif [[ "$FROM_INPUT" =~ ^[0-9]+\.[0-9]+\.[0-9]+-[0-9]+$ ]]; then
  VERSION="$FROM_INPUT"
elif [[ "$FROM_INPUT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # Bare minor: pick the highest build number of that minor on TO_REF.
  ESC="${FROM_INPUT//./\\.}"
  LAST_BUILD=$(git log "$TO_REF" --format=%s \
      --grep="^chore: release ${ESC}-[0-9]*\$" \
      --grep="^Version update: ${ESC}-[0-9]*\$" |
    sed -E 's/^(chore: release |Version update: )//' |
    sort -V | tail -1)
  if [ -z "$LAST_BUILD" ]; then
    echo "error: no release commits found for minor ${FROM_INPUT} on ${TO_REF}" >&2
    exit 1
  fi
  VERSION="$LAST_BUILD"
  echo "note: bare minor ${FROM_INPUT} resolved to its last build ${VERSION}" >&2
else
  echo "error: unrecognized version format '${FROM_INPUT}'" >&2
  exit 1
fi

# --- Resolve the version to a commit -----------------------------------------
ESC="${VERSION//./\\.}"
FROM_COMMIT=$(git rev-list -1 "$TO_REF" --grep="^chore: release ${ESC}\$")
if [ -z "$FROM_COMMIT" ]; then
  FROM_COMMIT=$(git rev-list -1 "$TO_REF" --grep="^Version update: ${ESC}\$")
fi
if [ -z "$FROM_COMMIT" ]; then
  FROM_COMMIT=$(git rev-parse -q --verify "refs/tags/${VERSION}-staging^{commit}" || true)
fi
if [ -z "$FROM_COMMIT" ]; then
  echo "error: could not resolve ${VERSION} to a commit on ${TO_REF}" >&2
  echo "       (tried 'chore: release ${VERSION}', 'Version update: ${VERSION}'," >&2
  echo "        and tag ${VERSION}-staging)" >&2
  exit 1
fi

# --- Collect and filter commit subjects --------------------------------------
# Filters mirror scripts/generateReleaseNotes.sh plus obvious non-user-facing
# prefixes. Keep the two in sync if you change either.
NOISE='^(chore: release |Version update: |Merge |chore\(deps|build\(deps|ci[(:]|docs[(:]|test[(:])'

TOTAL=$(git rev-list --count "${FROM_COMMIT}..${TO_REF}")
SUBJECTS=$(git log --reverse --format=%s "${FROM_COMMIT}..${TO_REF}" |
  grep -vE "$NOISE" || true)
RELEVANT=$(printf '%s' "$SUBJECTS" | grep -c . || true)

echo "FROM_VERSION=${VERSION}"
echo "FROM_COMMIT=$(git log -1 --format='%h %s' "$FROM_COMMIT")"
echo "TO_REF=${TO_REF} ($(git log -1 --format='%h, %cs' "$TO_REF"))"
echo "TO_VERSION=$(git show "${TO_REF}:package.json" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).version))')"
echo "TOTAL_COMMITS=${TOTAL}"
echo "RELEVANT_COMMITS=${RELEVANT}"
echo "---"
printf '%s\n' "$SUBJECTS"
