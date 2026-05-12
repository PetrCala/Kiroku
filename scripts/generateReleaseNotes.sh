#!/bin/bash
set -euo pipefail

# Find previous tag; fall back to first commit if no tags exist
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)

# Collect commit subjects since that tag; skip version bump commits
COMMITS=$(git log "${PREV_TAG}..HEAD" --pretty=format:"- %s" \
  | grep -v "^- chore: release" \
  | head -40) || COMMITS=""

FALLBACK="Improvements and bug fixes."

if [ -z "$COMMITS" ]; then
  CHANGELOG="$FALLBACK"
else
  COMMITS_JSON=$(printf '%s' "$COMMITS" | jq -Rs '.')
  RESPONSE=$(curl -sf https://api.anthropic.com/v1/messages \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "{
      \"model\": \"claude-haiku-4-5-20251001\",
      \"max_tokens\": 300,
      \"messages\": [{
        \"role\": \"user\",
        \"content\": \"Write concise TestFlight beta release notes for a mobile app update. 2-4 bullet points, plain English, no technical jargon, focus on what users will notice. Keep the total under 300 characters. Changes:\\n\" $COMMITS_JSON
      }]
    }") || true

  CHANGELOG=$(printf '%s' "$RESPONSE" | jq -r '.content[0].text // empty' 2>/dev/null) || CHANGELOG=""
  [ -z "$CHANGELOG" ] && CHANGELOG="$FALLBACK"
fi

# Write to GitHub env if running in CI, otherwise print to stdout
if [ -n "${GITHUB_ENV:-}" ]; then
  { echo "TESTFLIGHT_CHANGELOG<<EOF"; echo "$CHANGELOG"; echo "EOF"; } >> "$GITHUB_ENV"
else
  echo "$CHANGELOG"
fi
