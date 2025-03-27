#!/bin/bash

set -e

# Static
BRANCH="master" # Main branch of the submodule

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

PROJECT_ROOT_REL=$(dirname "$SCRIPTS_DIR")
PROJECT_ROOT=$(get_abs_path "$PROJECT_ROOT_REL")

info "Initializing and updating submodules..."
cd $PROJECT_ROOT
git submodule update --init --recursive

info "Pulling latest changes from kiroku-api submodule..."
cd api
git checkout $BRANCH
git pull origin $BRANCH

# Check if there are any changes in the submodule
if [ -z "$(git diff --name-only HEAD@{1} HEAD)" ]; then
  success "No changes detected in the kiroku-api submodule. Exiting early."
  exit 0
fi

COMMIT=$(git rev-parse --short HEAD)

info "Returning to main repo and committing submodule update..."
cd ..
git add api
git commit -m "Update kiroku-api submodule to latest commit $COMMIT"
git push origin $BRANCH

success "kiroku-api submodule updated successfully!"
