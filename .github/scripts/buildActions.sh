#!/bin/bash
#
# Used to precompile all Github Action node.js scripts using ncc.
# This bundles them with their dependencies into a single executable node.js script.

# In order for this script to be safely run from anywhere, we cannot use the raw relative path '../actions'.
declare ACTIONS_DIR
ACTIONS_DIR="$(dirname "$(dirname "$0")")/actions/javascript"

# List of paths to all JS files that implement our GH Actions
declare -r GITHUB_ACTIONS=(
    "$ACTIONS_DIR/awaitStagingDeploys/awaitStagingDeploys.ts"
    "$ACTIONS_DIR/authorChecklist/authorChecklist.ts"
    "$ACTIONS_DIR/bumpVersion/bumpVersion.ts"
    "$ACTIONS_DIR/checkDeployBlockers/checkDeployBlockers.ts"
    "$ACTIONS_DIR/createOrUpdateStagingDeploy/createOrUpdateStagingDeploy.ts"
    "$ACTIONS_DIR/getDeployPullRequestList/getDeployPullRequestList.ts"
    # "$ACTIONS_DIR/getPreviousVersion/getPreviousVersion.ts"
    # "$ACTIONS_DIR/getPullRequestDetails/getPullRequestDetails.ts"
    # "$ACTIONS_DIR/getReleaseBody/getReleaseBody.ts"
    "$ACTIONS_DIR/isStagingDeployLocked/isStagingDeployLocked.ts"
    "$ACTIONS_DIR/markPullRequestsAsDeployed/markPullRequestsAsDeployed.ts"
    "$ACTIONS_DIR/postTestBuildComment/postTestBuildComment.ts"
    "$ACTIONS_DIR/reopenIssueWithComment/reopenIssueWithComment.ts"
    # "$ACTIONS_DIR/verifySignedCommits/verifySignedCommits.ts"
    # "$ACTIONS_DIR/reviewerChecklist/reviewerChecklist.ts"
    # "$ACTIONS_DIR/validateReassureOutput/validateReassureOutput.ts"
    # "$ACTIONS_DIR/getArtifactInfo/getArtifactInfo.ts"
)

# This will be inserted at the top of all compiled files as a warning to devs.
declare -r NOTE_DONT_EDIT='/**
 * NOTE: This is a compiled file. DO NOT directly edit this file.
 */
'

declare -a SELECTED_ACTIONS
declare -a ACTIVE_PIDS
declare -a ACTIVE_ACTIONS
declare -a ACTIVE_OUTPUT_FILES
declare EXIT_CODE=0

function usage {
    echo 'Usage: npm run gh-actions-build -- [actionName ...]'
    echo
    echo 'Examples:'
    echo '  npm run gh-actions-build'
    echo '  npm run gh-actions-build -- bumpVersion'
    echo '  GHA_BUILD_CONCURRENCY=2 npm run gh-actions-build'
}

function getDefaultConcurrency {
    if [[ -n "${GHA_BUILD_CONCURRENCY:-}" ]]; then
        echo "$GHA_BUILD_CONCURRENCY"
        return
    fi

    if [[ -n "${CI:-}" ]]; then
        echo 2
        return
    fi

    echo 1
}

declare BUILD_CONCURRENCY
BUILD_CONCURRENCY="$(getDefaultConcurrency)"

if [[ ! "$BUILD_CONCURRENCY" =~ ^[1-9][0-9]*$ ]]; then
    echo "Invalid GHA_BUILD_CONCURRENCY: $BUILD_CONCURRENCY"
    exit 1
fi

function actionName {
    basename "$(dirname "$1")"
}

function hasSelectedAction {
    local CANDIDATE=$1

    for SELECTED_ACTION in "${SELECTED_ACTIONS[@]}"; do
        if [[ "$SELECTED_ACTION" == "$CANDIDATE" ]]; then
            return 0
        fi
    done

    return 1
}

function appendSelectedAction {
    local ACTION=$1

    if hasSelectedAction "$ACTION"; then
        return
    fi

    SELECTED_ACTIONS+=("$ACTION")
}

function selectActions {
    if [[ $# -eq 0 ]]; then
        SELECTED_ACTIONS=("${GITHUB_ACTIONS[@]}")
        return
    fi

    for REQUESTED_ACTION in "$@"; do
        if [[ "$REQUESTED_ACTION" == '-h' || "$REQUESTED_ACTION" == '--help' ]]; then
            usage
            exit 0
        fi

        local FOUND=false
        for ACTION in "${GITHUB_ACTIONS[@]}"; do
            local NAME
            NAME=$(actionName "$ACTION")
            local SOURCE_FILE
            SOURCE_FILE=$(basename "$ACTION")
            local RELATIVE_PATH
            RELATIVE_PATH="${ACTION#"$ACTIONS_DIR"/}"

            if [[ "$REQUESTED_ACTION" == "$NAME" ||
                "$REQUESTED_ACTION" == "$SOURCE_FILE" ||
                "$REQUESTED_ACTION" == "$RELATIVE_PATH" ||
                "$REQUESTED_ACTION" == "$ACTION" ]]; then
                appendSelectedAction "$ACTION"
                FOUND=true
            fi
        done

        if [[ "$FOUND" != true ]]; then
            echo "Unknown GitHub Action: $REQUESTED_ACTION"
            usage
            exit 1
        fi
    done
}

function cleanupBuilds {
    if [[ ${#ACTIVE_PIDS[@]} -eq 0 ]]; then
        return
    fi

    echo 'Stopping active ncc builds...'
    kill "${ACTIVE_PIDS[@]}" 2>/dev/null || true

    for PID in "${ACTIVE_PIDS[@]}"; do
        wait "$PID" 2>/dev/null || true
    done
}

trap 'cleanupBuilds; exit 130' INT TERM

function prependCompiledFileNote {
    local OUTPUT_FILE=$1
    local TEMP_OUTPUT_FILE="$OUTPUT_FILE.tmp"

    printf '%s' "$NOTE_DONT_EDIT" >"$TEMP_OUTPUT_FILE"
    cat "$OUTPUT_FILE" >>"$TEMP_OUTPUT_FILE"
    mv "$TEMP_OUTPUT_FILE" "$OUTPUT_FILE"
}

function startBuildAction {
    local ACTION=$1
    local ACTION_DIR
    ACTION_DIR=$(dirname "$ACTION")
    local OUTPUT_FILE="$ACTION_DIR/index.js"

    # Type checking is handled by separate workflows. Keeping ncc in transpile-only
    # mode makes action bundling independent from unrelated app TypeScript errors.
    ncc build "$ACTION" --transpile-only -o "$ACTION_DIR" &

    ACTIVE_PIDS+=("$!")
    ACTIVE_ACTIONS+=("$ACTION")
    ACTIVE_OUTPUT_FILES+=("$OUTPUT_FILE")
}

function removeActiveBuild {
    local INDEX=$1

    ACTIVE_PIDS=("${ACTIVE_PIDS[@]:0:$INDEX}" "${ACTIVE_PIDS[@]:$((INDEX + 1))}")
    ACTIVE_ACTIONS=("${ACTIVE_ACTIONS[@]:0:$INDEX}" "${ACTIVE_ACTIONS[@]:$((INDEX + 1))}")
    ACTIVE_OUTPUT_FILES=("${ACTIVE_OUTPUT_FILES[@]:0:$INDEX}" "${ACTIVE_OUTPUT_FILES[@]:$((INDEX + 1))}")
}

function waitForActiveBuild {
    local INDEX=$1
    local PID=${ACTIVE_PIDS[$INDEX]}
    local ACTION=${ACTIVE_ACTIONS[$INDEX]}
    local OUTPUT_FILE=${ACTIVE_OUTPUT_FILES[$INDEX]}
    local NAME
    NAME=$(actionName "$ACTION")

    if wait "$PID"; then
        prependCompiledFileNote "$OUTPUT_FILE"
        echo "Built $NAME"
    else
        local RESULT=$?
        echo "Failed to build $NAME"
        EXIT_CODE=$RESULT
    fi

    removeActiveBuild "$INDEX"
}

function waitForOpenBuildSlot {
    while [[ ${#ACTIVE_PIDS[@]} -ge "$BUILD_CONCURRENCY" ]]; do
        waitForActiveBuild 0
    done
}

selectActions "$@"

echo "Building ${#SELECTED_ACTIONS[@]} GitHub Action(s) with concurrency $BUILD_CONCURRENCY"

for ACTION in "${SELECTED_ACTIONS[@]}"; do
    waitForOpenBuildSlot

    startBuildAction "$ACTION"
done

while [[ ${#ACTIVE_PIDS[@]} -gt 0 ]]; do
    waitForActiveBuild 0
done

exit "$EXIT_CODE"
