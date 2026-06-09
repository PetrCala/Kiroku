/**
 * The four mutually-exclusive states of the FriendListScreen list area.
 *
 * - `loading` — `app/open` hasn't delivered the friend list yet and it can still
 *   arrive (we're online). Render the spinner.
 * - `offlineUnavailable` — the friend list hasn't resolved and can't: we're
 *   offline with nothing cached for this user (e.g. a first launch that never
 *   reached the network). Render a "reconnect to load" notice, never a false
 *   "no friends" state — the user may well have friends we simply haven't
 *   fetched.
 * - `empty` — the bootstrap completed and the user genuinely has no friends.
 *   Render the welcome/empty state with the "add friends" CTA.
 * - `data` — there are friends to render (including a warm cache while offline).
 */
type FriendListContentState =
  | 'loading'
  | 'offlineUnavailable'
  | 'empty'
  | 'data';

/**
 * Decide what the FriendListScreen list area should render.
 *
 * `app/open` is the only thing that hydrates the signed-in user's friend list,
 * and it flips `IS_LOADING_APP` to `false` in its `finallyData` once it
 * resolves. Until then an empty list is indistinguishable from "not loaded", so
 * the network state disambiguates "still coming" (online → `loading`) from
 * "can't come" (offline → `offlineUnavailable`). A non-empty list is
 * authoritative regardless of network — a warm cache paints instantly, even
 * offline.
 *
 * @param friendCount Number of friends currently known (from the hydrated list).
 * @param isLoadingApp The `IS_LOADING_APP` bootstrap flag. `undefined` until the
 *   first `openApp` optimistic write lands; only `false` means "bootstrap done".
 * @param isOffline Whether the device is offline (`useNetwork`).
 */
function getFriendListContentState(
  friendCount: number,
  isLoadingApp: boolean | undefined,
  isOffline: boolean,
): FriendListContentState {
  if (friendCount > 0) {
    return 'data';
  }
  const isBootstrapComplete = isLoadingApp === false;
  if (!isBootstrapComplete) {
    return isOffline ? 'offlineUnavailable' : 'loading';
  }
  return 'empty';
}

export default getFriendListContentState;
export type {FriendListContentState};
