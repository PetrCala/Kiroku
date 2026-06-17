import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import type {OpenFriendPreferencesParams} from '@libs/API/parameters';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Preferences, Theme} from '@src/types/onyx';
import type Response from '@src/types/onyx/Response';
import type {UserID} from '@src/types/onyx/OnyxCommon';

/**
 * Preference writes, cut over from direct Firebase RTDB writes to the kiroku-api
 * `POST /v1/preferences` endpoint. The server validates the partial update and
 * writes each recognized field under `user_preferences/$uid` (the same nodes the
 * legacy writes targeted). Authority is server-side (the caller's Firebase ID
 * token), so callers pass only the changed fields.
 *
 * Reads now hydrate from Onyx (`app/open` + kiroku-api updates) rather than a
 * Firebase preferences listener — the #809 read cutover is complete.
 */

/**
 * Optimistic Onyx updates mirroring the server's `onyxData`.
 *
 * The whole partial update is merged into the `PREFERENCES` key so changes
 * (palette, toggles, etc.) reflect across the app instantly. This mirrors
 * exactly what the server does (`merge(PREFERENCES, patch)`), so re-applying
 * the same patch on the inline/pushed response is idempotent.
 *
 * `theme` and `locale` additionally have dedicated top-level Onyx keys, so they
 * are also echoed there.
 */
function preferencesOptimisticData(
  updates: Partial<Preferences>,
): OnyxUpdate[] {
  const optimisticData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.PREFERENCES,
      value: updates,
    },
  ];
  if (updates.theme !== undefined) {
    optimisticData.push({
      onyxMethod: Onyx.METHOD.SET,
      key: ONYXKEYS.PREFERRED_THEME,
      value: updates.theme,
    });
  }
  if (updates.locale !== undefined) {
    optimisticData.push({
      onyxMethod: Onyx.METHOD.SET,
      key: ONYXKEYS.NVP_PREFERRED_LOCALE,
      value: updates.locale,
    });
  }
  return optimisticData;
}

/** Persist a partial preferences update via kiroku-api. */
function updatePreferences(updates: Partial<Preferences>): Promise<void> {
  API.write(WRITE_COMMANDS.UPDATE_PREFERENCES, updates, {
    optimisticData: preferencesOptimisticData(updates),
  });
  return Promise.resolve();
}

/** Update the user's preferred theme, then navigate back. */
function updateTheme(theme: Theme): Promise<void> {
  const result = updatePreferences({theme});
  Navigation.goBack();
  return result;
}

/**
 * Persist the auto-close threshold (hours of inactivity before an ongoing
 * session is finalized automatically), then navigate back. `null` is the
 * "Never" opt-out. Passing `undefined` would clear the field back to inheriting
 * the global default, but the picker only ever sends a number or `null`.
 *
 * Server-side validation for this numeric key ships in kiroku-api (PR2 of
 * #1293); until then the write is accepted but may be a no-op server-side. The
 * optimistic Onyx merge keeps the UI correct regardless.
 */
function updateAutoCloseSessionsAfterHours(
  hours: number | null,
): Promise<void> {
  const result = updatePreferences({auto_close_sessions_after_hours: hours});
  Navigation.goBack();
  return result;
}

/**
 * Read a FRIEND's rendering preferences (units→colors, drinks→units, palette)
 * via the privacy-enforced `GET /v1/users/:uid/preferences` API — replacing the
 * direct Firebase RTDB read the friend calendar used to do through
 * `useFetchData(['preferences'])`. The server gates the read (friends +
 * visibility) and delivers the prefs as onyxData under
 * `userDataList[userID].preferences`; a denied/hidden read evicts that key
 * (Kiroku #786). Returns the promise so the friend-preferences hook can settle
 * its loading state once the round-trip lands.
 */
function openFriendPreferences(userID: UserID): Promise<void | Response> {
  const parameters: OpenFriendPreferencesParams = {userID};
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    READ_COMMANDS.OPEN_FRIEND_PREFERENCES,
    parameters,
    {},
    CONST.API_REQUEST_TYPE.READ,
  );
}

export {
  updatePreferences,
  updateTheme,
  updateAutoCloseSessionsAfterHours,
  openFriendPreferences,
};
