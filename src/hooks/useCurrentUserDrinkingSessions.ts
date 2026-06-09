import {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSessionList} from '@src/types/onyx';

// Stable reference for the "loaded but empty" case so memoized consumers don't
// churn on every render.
const EMPTY_SESSIONS: DrinkingSessionList = {};

/**
 * The signed-in user's drinking sessions, sourced from Onyx
 * `CACHED_DRINKING_SESSIONS` — hydrated by `app/open` and kept in sync via the
 * session-write `onyxData` + Pusher / `/v1/updates` (kiroku-api), not a Firebase
 * listener.
 *
 * The cache stores `null` for "loaded, no sessions"; we surface that as an empty
 * object so consumers treat it as ready-but-empty (matching the old windowed
 * listener, which seeded `{}`), and `undefined` only while the cache is still
 * resolving.
 *
 * "Resolving" is keyed on Onyx's hydration `status`, NOT on the value being
 * `undefined`. The two are not the same: once the key has finished loading from
 * disk it can legitimately hold no entry for this user (a brand-new account; a
 * post-sign-out reset, which writes `null`; or an offline cold start where
 * `app/open` never reached the network). All of those are "loaded, no sessions"
 * — surfacing them as `undefined` would read as "still loading" and leave the
 * home skeletons spinning forever offline, since no network fetch can ever
 * arrive to flip the gate. Only `status === 'loading'` means undefined.
 */
function useCurrentUserDrinkingSessions(): DrinkingSessionList | undefined {
  const {auth} = useFirebase();
  const userID = auth?.currentUser?.uid;
  const [cachedByUser, {status}] = useOnyx(ONYXKEYS.CACHED_DRINKING_SESSIONS);
  if (!userID) {
    return undefined;
  }
  const cached = cachedByUser?.[userID];
  if (cached) {
    return cached;
  }
  // Hydration finished but there's no entry for this user → ready-but-empty.
  return status === 'loaded' ? EMPTY_SESSIONS : undefined;
}

export default useCurrentUserDrinkingSessions;
