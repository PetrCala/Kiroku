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
 */
function useCurrentUserDrinkingSessions(): DrinkingSessionList | undefined {
  const {auth} = useFirebase();
  const userID = auth?.currentUser?.uid;
  const [cachedByUser] = useOnyx(ONYXKEYS.CACHED_DRINKING_SESSIONS);
  if (!userID) {
    return undefined;
  }
  const cached = cachedByUser?.[userID];
  return cached === null ? EMPTY_SESSIONS : cached;
}

export default useCurrentUserDrinkingSessions;
