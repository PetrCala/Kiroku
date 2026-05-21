import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import Log from '@libs/Log';

/**
 * `users/{uid}` snapshots used to live under a single Onyx key
 * `USER_DATA_LIST: Record<UserID, UserData>`. They've moved to a per-user
 * collection at `${COLLECTION.USER_DATA}${uid}`, written through by the
 * Firebase listener (auth user) and `useUserDataFetch` (friends).
 *
 * The legacy blob was only ever populated by optimistic action writes
 * (timezone updates, onboarding flags, terms acceptance) — the live Firebase
 * listener wrote to React state in `DatabaseDataContext`, never to Onyx. So
 * legacy entries are always partial (no `profile`, no `friends`, etc.).
 *
 * Copying those partial entries into the new collection would leave
 * `useOnyx(${prefix}${uid})` returning a truthy-but-incomplete object on
 * first launch — worse than no entry, because consumers that gate on
 * `!!userData` would then try to access `userData.profile.photo_url` on a
 * partial snapshot and crash.
 *
 * The safe move is to drop the legacy key entirely. Every value the legacy
 * blob carried also lives in Firebase (the action writes hit RTDB too), so
 * the listener will repopulate the full snapshot on its first fire after
 * upgrade. Users wait one round trip on first launch; nothing is lost.
 *
 * The legacy key is read first and the storage write is only issued when
 * there's actually something to clear — so warm launches (post-clear) finish
 * the migration in microtask time and don't extend the splash-to-app
 * handoff window.
 */
export default function DropLegacyUserDataList(): Promise<void> {
  return new Promise<void>(resolve => {
    // eslint-disable-next-line rulesdir/no-onyx-connect
    const connectionID = Onyx.connect({
      key: ONYXKEYS.USER_DATA_LIST,
      callback: value => {
        Onyx.disconnect(connectionID);
        if (value === null || value === undefined) {
          resolve();
          return;
        }
        Log.info('[Migrate Onyx] DropLegacyUserDataList: clearing legacy key');
        // eslint-disable-next-line rulesdir/prefer-actions-set-data
        Onyx.set(ONYXKEYS.USER_DATA_LIST, null)
          .then(() => resolve())
          .catch(() => resolve());
      },
    });
  });
}
