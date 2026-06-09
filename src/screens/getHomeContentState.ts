import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type {DrinkingSessionList, Preferences} from '@src/types/onyx';

/**
 * The four mutually-exclusive states of the HomeScreen main content.
 *
 * - `loading` — still waiting for `app/open` to deliver the initial snapshot,
 *   and it can still arrive (we're online). Render skeletons.
 * - `offlineUnavailable` — the snapshot hasn't resolved and can't: we're offline
 *   with nothing cached for this user (e.g. after a sign-out, which nulls
 *   `CACHED_DRINKING_SESSIONS`, while offline so `app/open` can't re-seed it).
 *   Render a "reconnect to load" notice, never a false "no sessions" state.
 * - `empty` — the snapshot resolved and the user genuinely has no sessions
 *   (`app/open` always seeds `{[uid]: {}}` for them). Render the welcome state.
 * - `data` — the snapshot resolved with sessions. Render the calendar + stats.
 */
type HomeContentState = 'loading' | 'offlineUnavailable' | 'empty' | 'data';

/**
 * Decide what the HomeScreen main content should render.
 *
 * `preferences` / `drinkingSessionData` are `undefined` only until `app/open`
 * delivers them (or a warm cache hydrates from disk). When they haven't
 * resolved, the network state disambiguates "still coming" (online → `loading`)
 * from "can't come" (offline → `offlineUnavailable`). Once resolved, emptiness
 * is authoritative because `app/open` always seeds the user's entry.
 */
function getHomeContentState(
  preferences: Preferences | undefined,
  drinkingSessionData: DrinkingSessionList | undefined,
  isOffline: boolean,
): HomeContentState {
  const isReady = !!preferences && drinkingSessionData !== undefined;
  if (!isReady) {
    return isOffline ? 'offlineUnavailable' : 'loading';
  }
  return isEmptyObject(drinkingSessionData) ? 'empty' : 'data';
}

export default getHomeContentState;
export type {HomeContentState};
