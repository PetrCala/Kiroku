import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {UserDataList} from '@src/types/onyx';
import Log from '@libs/Log';

/**
 * `users/{uid}` snapshots used to live under a single Onyx key
 * `USER_DATA_LIST: Record<UserID, UserData>`. They've moved to a per-user
 * collection at `${COLLECTION.USER_DATA}${uid}` so:
 *   - the auth-user listener and friend-profile fetcher share one store
 *   - each consumer subscribes to a specific UID (per-entry reactivity)
 *
 * This migration copies each entry from the legacy blob into its own
 * collection slot, then nulls out the legacy key. Pre-auth: safe because the
 * legacy values are themselves keyed by UID inside their payload, no auth
 * context required.
 */
export default function MigrateUserDataListToCollection(): Promise<void> {
  return new Promise<void>(resolve => {
    // Migrations are one of the few legitimate places to use `Onyx.connect`
    // directly — we need a single read of the legacy key and have no
    // surrounding React context to subscribe through.
    // eslint-disable-next-line rulesdir/no-onyx-connect
    const connectionID = Onyx.connect({
      key: ONYXKEYS.USER_DATA_LIST,
      callback: (legacyList: UserDataList | undefined | null) => {
        Onyx.disconnect(connectionID);

        if (!legacyList) {
          Log.info(
            '[Migrate Onyx] MigrateUserDataListToCollection: no legacy data',
          );
          resolve();
          return;
        }

        const entries = Object.entries(legacyList);
        if (entries.length === 0) {
          Log.info(
            '[Migrate Onyx] MigrateUserDataListToCollection: legacy list empty',
          );
          // Still clear the now-empty single key.
          // eslint-disable-next-line rulesdir/prefer-actions-set-data
          Onyx.set(ONYXKEYS.USER_DATA_LIST, null).then(() => resolve());
          return;
        }

        Log.info(
          `[Migrate Onyx] MigrateUserDataListToCollection: copying ${entries.length} entries`,
        );

        const writes = entries.map(([uid, userData]) =>
          // eslint-disable-next-line rulesdir/prefer-actions-set-data
          Onyx.set(`${ONYXKEYS.COLLECTION.USER_DATA}${uid}`, userData ?? null),
        );

        Promise.all(writes)
          // eslint-disable-next-line rulesdir/prefer-actions-set-data
          .then(() => Onyx.set(ONYXKEYS.USER_DATA_LIST, null))
          .then(() => resolve())
          .catch(() => resolve());
      },
    });
  });
}
