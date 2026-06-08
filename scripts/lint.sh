#!/bin/bash

# Run ESLint with the repo's standard flags (adaptive heap + concurrency, see
# the RESOURCE POLICY note below; shared content cache). Delegate target
# selection to the caller:
#
#   ./scripts/lint.sh                      -> lint the whole repo
#   ./scripts/lint.sh src/foo.ts ...       -> lint just the given paths
#   ./scripts/lint.sh --show-warnings ...  -> include grandfathered seatbelt warnings in the output
#
# By default we pass `--quiet` to ESLint so only blocking errors are printed.
# eslint-seatbelt reclassifies grandfathered violations as warnings, so the
# default output mirrors what CI cares about. Pass `--show-warnings` to
# restore the full output (errors + warnings).

set -euo pipefail

# parse args
USE_CACHE=true
SHOW_WARNINGS=false
PASSTHROUGH_ARGS=()
for ARG in "$@"; do
    case "$ARG" in
        --no-cache)
            USE_CACHE=false
            ;;
        --show-warnings)
            SHOW_WARNINGS=true
            ;;
        *)
            PASSTHROUGH_ARGS+=("$ARG")
            ;;
    esac
done

# Preserve default behavior of linting the whole repo when no target is passed.
if [[ "${#PASSTHROUGH_ARGS[@]}" -eq 0 ]]; then
    PASSTHROUGH_ARGS=(.)
fi

# ---------------------------------------------------------------------------
# RESOURCE POLICY  --  read before changing the concurrency / heap defaults
# ---------------------------------------------------------------------------
# ESLint here runs type-aware rules (`recommendedTypeChecked` +
# `parserOptions.project` in eslint.config.mjs), so EVERY invocation builds the
# full TypeScript program -- even `lint-changed` on a single file pays a
# ~tsc-sized memory cost. With `--concurrency=auto` each worker thread builds
# its OWN copy of that program, so peak RAM scales with the worker count.
#
# On a low-RAM dev machine that overruns physical memory and pushes the whole
# system into swap (the machine beachballs, not just a slow lint). So we pick
# concurrency and the Node heap ceiling from total system RAM:
#
#   >= 12 GB RAM (CI runners, beefy laptops): --concurrency=auto, 8 GB heap
#   <  12 GB RAM (e.g. an 8 GB laptop):       --concurrency=off,  RAM/2 heap
#
# DO NOT hard-code `--concurrency=auto` or `--max_old_space_size=8192` back in
# unconditionally -- that's exactly what makes an 8 GB box thrash. Override for
# a single run instead, e.g.:
#   LINT_CONCURRENCY=auto NODE_OPTIONS='--max_old_space_size=8192 --experimental-require-module' npm run lint-changed
# ---------------------------------------------------------------------------

# Total physical RAM in MB (0 if we can't tell).
detect_ram_mb() {
    if [[ -r /proc/meminfo ]]; then
        awk '/^MemTotal:/ {printf "%d", $2 / 1024; exit}' /proc/meminfo
    elif command -v sysctl >/dev/null 2>&1; then
        local bytes
        bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
        echo $(( bytes / 1024 / 1024 ))
    else
        echo 0
    fi
}

RAM_MB="$(detect_ram_mb)"
# Unknown RAM -> assume a capable machine so CI never regresses.
if [[ "$RAM_MB" -eq 0 || "$RAM_MB" -ge 12288 ]]; then
    DEFAULT_CONCURRENCY=auto
    DEFAULT_HEAP_MB=8192
else
    DEFAULT_CONCURRENCY=off
    DEFAULT_HEAP_MB=$(( RAM_MB / 2 ))
    [[ "$DEFAULT_HEAP_MB" -lt 2048 ]] && DEFAULT_HEAP_MB=2048
fi
LINT_CONCURRENCY="${LINT_CONCURRENCY:-$DEFAULT_CONCURRENCY}"

# Build ESLint args
ESLINT_ARGS=()
if [[ "$USE_CACHE" == "true" ]]; then
    ESLINT_ARGS+=(
        --cache
        --cache-location=node_modules/.cache/eslint
        --cache-strategy content
    )
fi
if [[ "$SHOW_WARNINGS" == "false" ]]; then
    ESLINT_ARGS+=(--quiet)
fi
# `--concurrency` / `--no-warn-ignored` go before PASSTHROUGH_ARGS so a caller
# can still override concurrency for one run (last value on the line wins).
ESLINT_ARGS+=(
    "--concurrency=${LINT_CONCURRENCY}"
    --no-warn-ignored
    "${PASSTHROUGH_ARGS[@]}"
)

# Run ESLint with the RAM-adaptive heap ceiling (see RESOURCE POLICY) and
# seatbelt behavior. `--experimental-require-module` lets CJS plugins (notably
# `eslint-plugin-rulesdir`) require() ESM rule files shipped by
# `eslint-config-expensify`. Enabled by default in Node 22.12+; we set it
# explicitly so Node 20.x continues to work.
NODE_OPTIONS="${NODE_OPTIONS:---max_old_space_size=${DEFAULT_HEAP_MB} --experimental-require-module}" \
SEATBELT_FROZEN="${SEATBELT_FROZEN:-0}" \
    exec npx eslint "${ESLINT_ARGS[@]}"
