import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Preferences} from '@src/types/onyx';

/**
 * The signed-in user's preferences, sourced from Onyx `PREFERENCES` — hydrated
 * by `app/open` and kept in sync via the preferences write `onyxData` + Pusher /
 * `/v1/updates` (kiroku-api), not a Firebase listener.
 *
 * Returns `undefined` only while the key is still resolving, matching the old
 * listener semantics consumers expect (`preferences === undefined` means "not
 * loaded yet").
 */
function useCurrentUserPreferences(): Preferences | undefined {
  const [preferences] = useOnyx(ONYXKEYS.PREFERENCES);
  return preferences;
}

export default useCurrentUserPreferences;
