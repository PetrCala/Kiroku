import Onyx from 'react-native-onyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import Log from './Log';
import DropLegacySessionsCalendarMonthsLoaded from './migrations/DropLegacySessionsCalendarMonthsLoaded';
import HydrateLegacyDrinkEntries from './migrations/HydrateLegacyDrinkEntries';

/**
 * The ordered list of Onyx schema migrations. A migration's schema version is
 * its 1-based position here: a store stamped with version N has already run
 * the first N entries. Append only. Reordering or deleting an entry shifts
 * every later version and would silently skip work on already-stamped installs.
 */
const MIGRATIONS = [
  DropLegacySessionsCalendarMonthsLoaded,
  HydrateLegacyDrinkEntries,
];

const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Read the stored schema version once. Anything that isn't a number (most
 * importantly a missing key, which is every install upgrading into this change)
 * counts as 0, so those stores still run the full list exactly once and only
 * then get stamped.
 */
function getStoredSchemaVersion(): Promise<number> {
  return new Promise(resolve => {
    // eslint-disable-next-line rulesdir/no-onyx-connect
    const connection = Onyx.connect({
      key: ONYXKEYS.ONYX_SCHEMA_VERSION,
      callback: value => {
        Onyx.disconnect(connection);
        resolve(typeof value === 'number' ? value : 0);
      },
    });
  });
}

/**
 * Run the migrations the stored version doesn't cover yet, in order, then stamp
 * the store. The stamp is written only after the whole batch resolves: a throw
 * (or a timeout) leaves the old version in place so the next launch retries.
 */
async function runPendingMigrations(): Promise<void> {
  const storedVersion = await getStoredSchemaVersion();
  if (storedVersion >= LATEST_SCHEMA_VERSION) {
    Log.info(
      `[Migrate Onyx] store is already at schema version ${storedVersion}, nothing to run`,
    );
    return;
  }

  const pending = MIGRATIONS.slice(storedVersion);
  Log.info(
    `[Migrate Onyx] running ${pending.length} migration(s) from schema version ${storedVersion}`,
  );
  await pending.reduce(
    (previousPromise, migration) => previousPromise.then(() => migration()),
    Promise.resolve(),
  );

  // eslint-disable-next-line rulesdir/prefer-actions-set-data
  await Onyx.set(ONYXKEYS.ONYX_SCHEMA_VERSION, LATEST_SCHEMA_VERSION);
  Log.info(`[Migrate Onyx] stamped schema version ${LATEST_SCHEMA_VERSION}`);
}

/**
 * Run any pending Onyx schema migrations, then let the app continue booting.
 *
 * This step is boot-critical: `Kiroku` gates the navigator and every modal on
 * the returned promise, so it MUST always settle, and settle fast. It therefore
 * swallows migration failures (logged via `Log.alert`) and races the work
 * against `BOOT_SPLASH_MIGRATION_TIMEOUT_MS`, which sits well below the
 * `SplashScreenHider` force-hide net. A broken or hung migration is allowed to
 * degrade the app; it must never brick the boot by pinning the splash until the
 * net dissolves it over an empty tree.
 *
 * Losing the race does not cancel the work: the migrations keep running and
 * stamp the store if they finish, and until they do the next launch retries
 * them from the same stored version.
 */
export default function (): Promise<void> {
  const startTime = Date.now();
  Log.info('[Migrate Onyx] start');

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>(resolve => {
    timeoutId = setTimeout(() => {
      Log.alert(
        `[Migrate Onyx] timed out after ${CONST.BOOT_SPLASH_MIGRATION_TIMEOUT_MS}ms, continuing boot without waiting for migrations`,
      );
      resolve();
    }, CONST.BOOT_SPLASH_MIGRATION_TIMEOUT_MS);
  });

  const migrations = runPendingMigrations().catch((error: unknown) => {
    Log.alert('[Migrate Onyx] migration failed, continuing boot', {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return Promise.race([migrations, timeout]).then(() => {
    clearTimeout(timeoutId);
    const timeElapsed = Date.now() - startTime;
    Log.info(`[Migrate Onyx] finished in ${timeElapsed}ms`);
  });
}

export {LATEST_SCHEMA_VERSION, MIGRATIONS};
