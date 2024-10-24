#!/bin/bash

set -e

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
source "$SCRIPTS_DIR/shellUtils.sh"

PROJECT_ROOT=$(dirname "$SCRIPTS_DIR")

cd "$PROJECT_ROOT"

info "Creating a mock database..."

ts-node --esm -e "import { createMockDatabase } from '@src/database/MockDatabase'; createMockDatabase();" # ts-node \

success "Done."
