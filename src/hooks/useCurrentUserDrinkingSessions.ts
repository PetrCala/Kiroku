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
 * The entry is `undefined` precisely until `app/open` delivers it: kiroku-api
 * *always* seeds `CACHED_DRINKING_SESSIONS = {[uid]: sessions ?? {}}` on open, so
 * after open the entry is always present — real data, or `{}` for a user with no
 * sessions. We surface a `null` entry as an empty object (consumers treat that as
 * ready-but-empty), and `undefined` while the snapshot is still resolving.
 *
 * Note `undefined` does NOT distinguish "loading" from "loaded, but offline with
 * no cached entry" (after sign-out, which sets the key to `null`, `app/open` can
 * never run to seed it). That distinction needs the network state and so is made
 * by the consumer (see `HomeScreen`'s `getHomeContentState`), not here — the hook
 * reports only the raw cache truth.
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
