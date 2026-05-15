#!/bin/bash
# Update GitHub repository secrets from local .env.* files.
#
# Mapping:
#   .env.adhoc      -> ADHOC_ENV_FILE
#   .env.dev        -> DEV_ENV_FILE
#   .env.production -> PRODUCTION_ENV_FILE
#   .env.staging    -> STAGING_ENV_FILE
#
# Usage:
#   scripts/updateEnvSecrets.sh              # update all four
#   scripts/updateEnvSecrets.sh adhoc dev    # update only the named envs

set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

ROOT_DIR=$(cd "$SCRIPTS_DIR/.." && pwd)

ALL_ENVS=(adhoc dev production staging)

usage() {
  cat <<EOF
Usage: $0 [env ...]

Updates the GitHub repository secret <ENV>_ENV_FILE from the matching
local .env.<env> file. With no arguments, all four envs are updated:
  ${ALL_ENVS[*]}
EOF
  exit 1
}

if ! command -v gh &>/dev/null; then
  error "gh CLI is not installed. See https://cli.github.com/"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  error "gh CLI is not authenticated. Run: gh auth login"
  exit 1
fi

# Validate selection
SELECTED=()
if [[ $# -eq 0 ]]; then
  SELECTED=("${ALL_ENVS[@]}")
else
  for arg in "$@"; do
    case "$arg" in
    -h | --help) usage ;;
    adhoc | dev | production | staging) SELECTED+=("$arg") ;;
    *)
      error "Unknown env: $arg"
      usage
      ;;
    esac
  done
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
info "Target repository: $REPO"

FAILED=()
for env_name in "${SELECTED[@]}"; do
  file="$ROOT_DIR/.env.$env_name"
  secret_name="$(echo "$env_name" | tr '[:lower:]' '[:upper:]')_ENV_FILE"

  title "Updating $secret_name from .env.$env_name"

  if [[ ! -f "$file" ]]; then
    error "Missing file: $file"
    FAILED+=("$env_name")
    continue
  fi

  if [[ ! -s "$file" ]]; then
    error "File is empty: $file"
    FAILED+=("$env_name")
    continue
  fi

  if gh secret set "$secret_name" --repo "$REPO" --body-file "$file"; then
    success "Updated $secret_name"
  else
    error "Failed to update $secret_name"
    FAILED+=("$env_name")
  fi
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
  error "Failed: ${FAILED[*]}"
  exit 1
fi

success "All selected secrets updated."
