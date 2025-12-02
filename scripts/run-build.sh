#!/bin/bash
set -e

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env file if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Default configuration values
IOS_MODE="DebugDevelopment"
IOS_SCHEME="Kiroku (development)"
IOS_SIMULATOR="iPhone 16 Pro"

ANDROID_MODE="developmentDebug"
ANDROID_APP_ID="com.alcohol_tracker.dev"

# Function to print error message and exit
function print_error_and_exit {
    echo "❌ Error: Invalid invocation. Please use one of: [--ios, --android]."
    exit 1
}

# Parse arguments
if [ "$#" -lt 1 ] || [[ "$1" != "--ios" && "$1" != "--android" ]]; then
    print_error_and_exit
fi

BUILD="$1"
shift

# Capture any additional flags to pass through to react-native
EXTRA_FLAGS=("$@")

# Check if the argument is one of the desired values
case "$BUILD" in
    --ios)
        echo "🍎 Starting iOS build..."
        echo "   Simulator: $IOS_SIMULATOR"
        echo "   Scheme: $IOS_SCHEME"
        echo "   Configuration: $IOS_MODE"
        echo ""

        # Set PATH to ensure node is available
        export PATH="/opt/homebrew/bin:$PATH"

        npx rock run:ios \
            --device "$IOS_SIMULATOR" \
            --scheme "$IOS_SCHEME" \
            --configuration $IOS_MODE \
            --dev-server \
            "${EXTRA_FLAGS[@]}"
        ;;

    --android)
        echo "🤖 Starting Android build..."
        echo "   App ID: $ANDROID_APP_ID"
        echo "   Variant: $ANDROID_MODE"
        echo ""

        # Set PATH to ensure node is available
        export PATH="/opt/homebrew/bin:$PATH"

        npx rock run:android \
            --variant $ANDROID_MODE \
            --app-id $ANDROID_APP_ID \
            --active-arch-only \
            --dev-server \
            "${EXTRA_FLAGS[@]}"
        ;;

    *)
        print_error_and_exit
        ;;
esac
