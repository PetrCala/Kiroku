import Onyx from 'react-native-onyx';
import type {Database} from 'firebase/database';
import {update, ref, set} from 'firebase/database';
import ONYXKEYS from '@src/ONYXKEYS';
import * as Localize from '@libs/Localize';
import Navigation from '@libs/Navigation/Navigation';
import type {Preferences, Theme} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import DBPATHS from '@src/DBPATHS';
import type {User} from '@firebase/auth';

/** Save preferences data into the database.
 *
 * Throw an error in case the save attempt fails.
 *
 * @param db Firebase database object
 * @param userID User ID
 * @param preferencesData New preferences
 * @returns
 *
 * @example
 * ```ts
 * const db = getDatabase();
 * const user = getCurrentUser();
 * const newDrinksToUnits = getDrinksToUnits();
 * await savePreferences(db, user.uid, {drinks_to_units: newDrinksToUnits});
 * ```
 */
async function updatePreferences(
  db: Database,
  user: User | null,
  updates: Partial<Preferences>,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }
  const preferencesRoute = DBPATHS.USER_PREFERENCES_USER_ID.getRoute(user.uid);
  await update(ref(db, preferencesRoute), updates);
}

/** Update the user's preferred theme */
async function updateTheme(db: Database, user: User | null, theme: Theme) {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }
  // const optimisticData: OnyxUpdate[] = [
  //   {
  //     onyxMethod: Onyx.METHOD.SET,
  //     key: ONYXKEYS.PREFERRED_THEME,
  //     value: theme,
  //   },
  // ];

  // const parameters: UpdateThemeParams = {
  //   value: theme,
  // };

  // API.write(WRITE_COMMANDS.UPDATE_THEME, parameters, {optimisticData});

  const dbPath = DBPATHS.USER_PREFERENCES_USER_ID_THEME;

  await set(ref(db, dbPath.getRoute(user.uid)), theme);
  await Onyx.set(ONYXKEYS.PREFERRED_THEME, theme);

  Navigation.goBack();
}

/**
 * Mirror an authoritative `user_preferences/{uid}` snapshot (from the live
 * listener or a one-shot `get()`) into the per-user Onyx collection entry so
 * consumers can read it via `useOnyx(\`${COLLECTION.PREFERENCES}${uid}\`)`.
 *
 * Pass `null` to clear the entry (e.g. when the listener reports the node is
 * gone).
 */
function setLivePreferencesForUser(
  userID: UserID,
  preferences: Preferences | null,
): void {
  Onyx.set(`${ONYXKEYS.COLLECTION.PREFERENCES}${userID}`, preferences ?? null);
}

export {updatePreferences, updateTheme, setLivePreferencesForUser};
