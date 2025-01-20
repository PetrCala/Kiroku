import type {Database} from 'firebase/database';
import {ref, update} from 'firebase/database';
import type {
  DrinkingSession,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkKey,
  DrinksToUnits,
  UserStatus,
} from '@src/types/onyx';
import * as Localize from '@libs/Localize';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {User} from 'firebase/auth';
import CONST from '@src/CONST';
import type {FirebaseUpdates} from '@database/baseFunctions';
import {generateDatabaseKey} from '@database/baseFunctions';
import Onyx from 'react-native-onyx';
import type {OnyxKey} from '@src/ONYXKEYS';
import ONYXKEYS from '@src/ONYXKEYS';
import Navigation from '@libs/Navigation/Navigation';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import {differenceInDays, startOfDay} from 'date-fns';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {ValueOf} from 'type-fest';
import _ from 'lodash';
import DBPATHS from '@src/DBPATHS';
import {Alert} from 'react-native';

const drinkingSessionRef = DBPATHS.USER_DRINKING_SESSIONS_USER_ID_SESSION_ID;
const userStatusRef = DBPATHS.USER_STATUS_USER_ID;
const userStatusLatestSessionRef = DBPATHS.USER_STATUS_USER_ID_LATEST_SESSION;

let ongoingSessionData: DrinkingSession | undefined;
Onyx.connect({
  key: ONYXKEYS.ONGOING_SESSION_DATA,
  callback: value => {
    if (!value) {
      return;
    }
    ongoingSessionData = value;
  },
});

// let editSessionData: DrinkingSession | undefined;
// Onyx.connect({
//   key: ONYXKEYS.EDIT_SESSION_DATA,
//   callback: value => {
//     if (!value) {
//       return;
//     }
//     editSessionData = value;
//   },
// });

/**
 * Set the edit session data object in Onyx so that it can be modified. This function should be called only if the relevant object already exists in the onyx database.
 *
 * @param sessionId The ID of the session
 * @param newData The new data to set
 */
async function updateLocalData(
  onyxKey: OnyxKey,
  newData: DrinkingSession | null,
  sessionId?: DrinkingSessionId,
): Promise<void> {
  let dataToSet: DrinkingSession | null = null;
  if (newData) {
    if (!sessionId) {
      throw new Error('You must specify the session ID.');
    }
    dataToSet = {id: sessionId, ...newData};
  }
  await Onyx.set(onyxKey, dataToSet);
}

/** Write drinking session data into the database
 *
 * @param db Firebase Database object
 * @param string userID User ID
 * @param updates The updates to send, with base path set to the session ID
 * @param updateStatus Whether to update the user status data or not
 * @returnsPromise void.
 *  */
async function updateDrinkingSessionData(
  db: Database,
  userID: UserID,
  updates: FirebaseUpdates,
  sessionId: DrinkingSessionId,
  updateStatus?: boolean,
): Promise<void> {
  const updatesToDB: FirebaseUpdates = {};

  const dsPath = drinkingSessionRef.getRoute(userID, sessionId);

  // Be mindful of using Object.forEach here, as that leads to an incorrect parsing of the object for some reason
  // eslint-disable-next-line you-dont-need-lodash-underscore/for-each, @typescript-eslint/no-unsafe-member-access
  _.forEach(updates, (value, key) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    updatesToDB[`${dsPath}/${key}`] = value;
  });

  if (updateStatus) {
    const userStatusPath = userStatusLatestSessionRef.getRoute(userID);
    // eslint-disable-next-line you-dont-need-lodash-underscore/for-each, @typescript-eslint/no-unsafe-member-access
    _.forEach(updates, (value, key) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      updatesToDB[`${userStatusPath}/${key}`] = value;
    });
  }

  await update(ref(db), updatesToDB);
}

/**
 * Check if the current live session data is the same as the one in the database. If not, update the local data.
 *
 * @param ongoingSessionId  The ID of the ongoing session.
 * @param drinkingSessionData  The drinking session data.
 */
async function syncLocalLiveSessionData(
  ongoingSessionId: DrinkingSessionId | undefined | null,
  drinkingSessionData: DrinkingSessionList | undefined | null,
) {
  if (ongoingSessionId && drinkingSessionData) {
    const newData = drinkingSessionData[ongoingSessionId];
    if (newData) {
      await updateLocalData(
        ONYXKEYS.ONGOING_SESSION_DATA,
        newData,
        ongoingSessionId,
      );
    }
  } else {
    Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, null);
  }
}

/** Start a live drinking session
 *
 * Assume that if a session is ongoing, it is a live session and its data is stored in the local database.
 *
 * @param db Firebase Database object
 * @param user User object
 * @returnsPromise newSessionId Id of the newly started session.
 *  */
async function startLiveDrinkingSession(
  db: Database,
  user: User | null,
  timezone: SelectedTimezone | undefined,
): Promise<void> {
  if (!user) {
    throw new Error('Failed to start a live session: User is null');
  }

  const newSessionId = generateDatabaseKey(
    db,
    DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(user.uid),
  );
  if (!newSessionId) {
    throw new Error(
      "Failed to start a live session: Couldn't generate a new session ID",
    );
  }

  // The user is not in an active session
  const newSessionData: DrinkingSession = DSUtils.getEmptySession({
    id: newSessionId,
    type: CONST.SESSION.TYPES.LIVE,
    timezone,
    ongoing: true,
  });
  const newStatusData: UserStatus = {
    last_online: new Date().getTime(),
    latest_session_id: newSessionId,
    latest_session: newSessionData,
  };

  // Update Firebase
  const updates: FirebaseUpdates = {};
  updates[userStatusRef.getRoute(user.uid)] = newStatusData;
  updates[drinkingSessionRef.getRoute(user.uid, newSessionId)] = newSessionData;
  await update(ref(db), updates);

  await Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, newSessionData);
}

/** Save final drinking session data to the database
 *
 * @param db Firebase Database object
 * @param string userID User ID
 * @param newSessionData Data to save the new drinking session with
 * @param sesisonKey ID of the session to edit (can be null in case of finishing the session)
 * @returnsPromise void.
 *  */
async function saveDrinkingSessionData(
  db: Database,
  userID: string,
  newSessionData: DrinkingSession,
  sessionKey: string,
  onyxKey: OnyxKey,
  sessionIsLive?: boolean,
): Promise<void> {
  const updates: FirebaseUpdates = {};
  if (sessionIsLive) {
    const userStatusData: UserStatus = {
      // ETC - 1
      last_online: new Date().getTime(),
      latest_session_id: sessionKey,
      latest_session: newSessionData,
    };
    updates[userStatusRef.getRoute(userID)] = userStatusData;
  }
  updates[drinkingSessionRef.getRoute(userID, sessionKey)] = newSessionData;

  await update(ref(db), updates);

  await Onyx.set(onyxKey, null);
}

/** Remove drinking session data from the database
 *
 * @param db Firebase Database object
 * @param userID User ID
 * @param sessionKey ID of the session to remove
 * @returns
 *  */
async function removeDrinkingSessionData(
  db: Database,
  userID: string,
  sessionKey: string,
  onyxKey: OnyxKey,
  sessionIsLive?: boolean,
): Promise<void> {
  const updates: FirebaseUpdates = {};
  updates[drinkingSessionRef.getRoute(userID, sessionKey)] = null;
  if (sessionIsLive) {
    const userStatusData: UserStatus = {
      last_online: new Date().getTime(),
      latest_session: null,
      latest_session_id: null,
    };
    updates[userStatusRef.getRoute(userID)] = userStatusData;
  }

  await update(ref(db), updates);

  await Onyx.set(onyxKey, null);
}

/**
 * Update the drinks list in a drinking session. Perform the changes locally and update the Onyx store.
 *
 * @param sessionId ID of the session to update.
 * @param drinks The drinks to add or remove.
 * @param drinksToUnits Drink to units mapping.
 * @param action The action to perform (i.e., add, remove,...).
 */
function updateDrinks(
  sessionId: DrinkingSessionId | undefined,
  drinkKey: DrinkKey,
  amount: number,
  action: ValueOf<typeof CONST.DRINKS.ACTIONS>,
  drinksToUnits: DrinksToUnits | undefined,
): void {
  if (!drinksToUnits || !sessionId) {
    return;
  }
  const session = DSUtils.getDrinkingSessionData(sessionId);
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(sessionId);
  if (session && onyxKey) {
    const drinksList = DSUtils.modifySessionDrinks(
      session,
      drinkKey,
      amount,
      action,
      drinksToUnits,
    );

    // const drinks = drinksList ? Object.values(drinksList)[0] : null;

    // Merge can only be used when adding drinks, or when removing drinks does not delete the drink key
    if (
      action === CONST.DRINKS.ACTIONS.ADD
      // ||
      // (drinks && Object.keys(drinks).includes(drinkKey))
    ) {
      Onyx.merge(onyxKey, {
        drinks: drinksList,
      });
    } else {
      Onyx.set(onyxKey, {
        ...session,
        drinks: drinksList,
      });
    }
  }
}

/**
 * Update a drinking session note
 *
 * @param session The session to update
 * @param newNote The new note
 * @returns void
 */
function updateNote(
  session: DrinkingSession | undefined,
  newNote: string,
): void {
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(session?.id);
  if (onyxKey) {
    Onyx.merge(onyxKey, {
      note: newNote,
    });
  }
}

function updateBlackout(
  session: DrinkingSession | undefined,
  blackout: boolean,
): void {
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(session?.id);
  if (onyxKey) {
    Onyx.merge(onyxKey, {
      blackout,
    });
  }
}

/**
 * Update a drinking session timezone
 *
 * @param session The session to update
 * @param newTimezone The new timezone
 * @returns void
 */
function updateTimezone(
  session: DrinkingSession | undefined,
  newTimezone: SelectedTimezone,
): void {
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(session?.id);
  if (onyxKey) {
    Onyx.merge(onyxKey, {
      timezone: newTimezone,
    });
  }
}

/**
 * Change all timestamps in a session so that its start time corresponds to a new date.
 *
 * Shift the timestamps by whole days, keeping the hour:minute times as they are.
 *
 * @param sessionId The ID of the session to modify
 * @param session The session to modify
 * @param newDate The new date to modify the session's timestamps to
 * @param shouldUpdateLiveSessionData Whether to update the live session data or not. If not specified, the function updates the edit session data.
 * @returns The modified session
 */
async function updateSessionDate(
  sessionId: DrinkingSessionId,
  session: DrinkingSession,
  newDate: Date,
  shouldUpdateLiveSessionData?: boolean,
): Promise<void> {
  const currentDate = startOfDay(new Date(session.start_time));
  const daysDelta = differenceInDays(currentDate, startOfDay(newDate));
  const millisecondsToSub = daysDelta * 24 * 60 * 60 * 1000;
  const modifiedSession = DSUtils.shiftSessionTimestamps(
    session,
    millisecondsToSub,
  );
  const onyxKey = shouldUpdateLiveSessionData
    ? ONYXKEYS.ONGOING_SESSION_DATA
    : ONYXKEYS.EDIT_SESSION_DATA;
  await updateLocalData(onyxKey, modifiedSession, sessionId);
}

/** Generate a new key for a drinking session */
function generateDrinkingSessionId(
  db: Database,
  user: User | null,
): DrinkingSessionId {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }
  const newKey = generateDatabaseKey(
    db,
    DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(user.uid),
  );
  if (!newKey) {
    throw new Error(Localize.translateLocal('common.error.sessionIdCreation'));
  }
  return newKey;
}

async function getNewSessionToEdit(
  db: Database,
  user: User | null,
  currentDate: Date,
  timezone: SelectedTimezone | undefined,
  shouldUpdateLocalData = true,
): Promise<DrinkingSession> {
  if (!user) {
    throw new Error('User is null when trying to create a new session');
  }
  const newSessionId = generateDrinkingSessionId(db, user);
  const timestamp = currentDate.getTime();
  const newSession: DrinkingSession = DSUtils.getEmptySession({
    id: newSessionId,
    start_time: timestamp,
    end_time: timestamp,
    type: CONST.SESSION.TYPES.EDIT,
    timezone,
  });

  if (shouldUpdateLocalData) {
    await updateLocalData(ONYXKEYS.EDIT_SESSION_DATA, newSession, newSessionId);
  }

  return newSession;
}

/** Set a value under the isCreatingNewSession onyx key */
async function setIsCreatingNewSession(val: boolean): Promise<void> {
  await Onyx.merge(ONYXKEYS.IS_CREATING_NEW_SESSION, val);
}

/**
 * Navigate to the an ongoing session screen
 *
 * Assume the session data is correctly synced with the local ongoingSessionData Onyx object
 *
 * @param sessionId ID of the session to navigate to
 * @param session Current session data
 */
function navigateToOngoingSessionScreen(): void {
  if (!ongoingSessionData?.id) {
    Alert.alert(Localize.translateLocal('drinkingSession.error.missingId'));
    return;
  }
  Navigation.navigate(
    ROUTES.DRINKING_SESSION_LIVE.getRoute(ongoingSessionData.id),
  );
}

async function updateLocalSessionDataAndNavigate(
  sessionId: DrinkingSessionId | undefined,
  session: DrinkingSession | undefined,
  onyxKey: OnyxKey,
  route: Route,
): Promise<void> {
  if (!sessionId) {
    throw new Error(Localize.translateLocal('drinkingSession.error.missingId'));
  }
  if (session) {
    await updateLocalData(onyxKey, session, sessionId);
  }
  Navigation.navigate(route);
}

/**
 * Navigate to the edit session screen. If the session object is provided, update the local data before navigating.
 *
 * @param sessionId ID of the session to navigate to
 * @param session Current session data
 */
async function navigateToEditSessionScreen(
  sessionId: DrinkingSessionId | undefined,
  session?: DrinkingSession,
  backTo?: Route,
): Promise<void> {
  if (!sessionId) {
    throw new Error(Localize.translateLocal('drinkingSession.error.missingId'));
  }

  await updateLocalSessionDataAndNavigate(
    sessionId,
    session,
    ONYXKEYS.EDIT_SESSION_DATA,
    ROUTES.DRINKING_SESSION_EDIT.getRoute(sessionId, backTo),
  );
}

export {
  generateDrinkingSessionId,
  navigateToEditSessionScreen,
  navigateToOngoingSessionScreen,
  removeDrinkingSessionData,
  saveDrinkingSessionData,
  setIsCreatingNewSession,
  startLiveDrinkingSession,
  syncLocalLiveSessionData,
  updateBlackout,
  updateDrinkingSessionData,
  updateDrinks,
  updateNote,
  updateLocalData,
  updateLocalSessionDataAndNavigate,
  updateSessionDate,
  updateTimezone,
  getNewSessionToEdit,
};
