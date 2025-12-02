#!/bin/bash

# DESCRIPTION: This script is used to reset the CocoaPods dependencies for the Kiroku project.
# It checks if the script is being run from the project root directory and then performs
# a soft or hard reset based on the argument passed to the script.
# The soft reset removes the Pods directory, podfile.lock, kiroku.xcworkspace, and the build directory.
# The hard reset additionally removes the CocoaPods cache and the Xcode derived data.
# Finally, it deintegrates the existing pods, sets up the pod environment, and installs the new pods.
# The script should be executed from the project root directory.
# Usage: ./podReset.sh [soft|hard]
# Example: ./podReset.sh soft

set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

# Navigate to the ios folder (same level as SCRIPTS_DIR)
PROJECT_ROOT=$(dirname "$SCRIPTS_DIR")

if [ ! -d "$PROJECT_ROOT/ios" ]; then
    error "ios folder does not exist!"
    exit 1
fi

cd "$PROJECT_ROOT/ios"

if [ "$1" == "soft" ]; then
    info "podfile soft reset"
elif [ "$1" == "hard" ]; then
    info "podfile hard reset"
    rm -rf ~/Library/Caches/CocoaPods
fi

rm -rf Pods

rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Remove all .xcworkspace files
find . -name "*.xcworkspace" -type d -exec rm -rf {} +

rm -rf build

pod deintegrate

cd -

success "pod reset complete!"

exit 0
