/**
 * Whether any friends-data batch read has settled during this app run. Module
 * scope on purpose: it resets exactly at the boundary the cold gate cares
 * about (an app restart) with no Onyx write, no persistence, and no cleanup
 * hook. Kept behind accessors (not a bare exported variable) so the hook stays
 * free of module-variable reassignment, which the React Compiler lint rejects
 * inside components.
 */
let hasSynced = false;

function hasSyncedThisAppRun(): boolean {
  return hasSynced;
}

function markSyncedThisAppRun(): void {
  hasSynced = true;
}

/** Test-only: module state would otherwise leak between jest cases. */
function resetSyncedThisAppRunForTests(): void {
  hasSynced = false;
}

export {
  hasSyncedThisAppRun,
  markSyncedThisAppRun,
  resetSyncedThisAppRunForTests,
};
