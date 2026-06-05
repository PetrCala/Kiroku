import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import Navigation from '@libs/Navigation/Navigation';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Preferences, Theme} from '@src/types/onyx';

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
 * Optimistic Onyx updates mirroring the server's `onyxData`. Only `theme` and
 * `locale` have dedicated top-level Onyx keys, so only those are echoed; the
 * remaining fields have no top-level key and are reflected by the Firebase
 * listener after the write lands. Mirroring the server keeps the inline/pushed
 * response idempotent.
 */
function preferencesOptimisticData(
  updates: Partial<Preferences>,
): OnyxUpdate[] {
  const optimisticData: OnyxUpdate[] = [];
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

export {updatePreferences, updateTheme};
