import CONST from '@src/CONST';
import type {
  DrinkKey,
  DrinkingSession,
  DrinkingSessionArray,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkingSessionType,
  Drinks,
  DrinksList,
  DrinksToUnits,
} from '@src/types/onyx';
import {ref, update} from 'firebase/database';
import type {Database} from 'firebase/database';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {SelectedTimezone, Timezone} from '@src/types/onyx/UserData';
import DBPATHS from '@src/DBPATHS';
import type {OnyxKey} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import {format, subMilliseconds} from 'date-fns';
import {formatInTimeZone} from 'date-fns-tz';
import type {
  AddDrinksOptions,
  RemoveDrinksOptions,
} from '@src/types/onyx/DrinkingSession';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import _ from 'lodash';
import type {ValueOf} from 'type-fest';
import type {ImageSourcePropType} from 'react-native';
import type {TranslationPaths} from '@src/languages/types';
import type IconAsset from '@src/types/utils/IconAsset';
import Log from './Log';
import DateUtils from './DateUtils';
import {roundToTwoDecimalPlaces} from './NumberUtils';
import {getFirebaseAuth} from './Firebase/FirebaseApp';
import {numberToVerboseString} from './TimeUtils';

const PlaceholderDrinks: DrinksList = {[Date.now()]: {other: 0}};

let timezone: Required<Timezone> = CONST.DEFAULT_TIME_ZONE;
Onyx.connect({
  key: ONYXKEYS.USER_DATA_LIST,
  callback: value => {
    // Safe to call getFirebaseAuth() here - Onyx callbacks run after app initialization
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      return;
    }
    const currentUserID = auth?.currentUser?.uid;
    const userDataTimezone = value?.[currentUserID]?.timezone;
    timezone = {
      selected: userDataTimezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected,
      automatic:
        userDataTimezone?.automatic ?? CONST.DEFAULT_TIME_ZONE.automatic,
    };
  },
});

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

let editSessionData: DrinkingSession | undefined;
Onyx.connect({
  key: ONYXKEYS.EDIT_SESSION_DATA,
  callback: value => {
    if (!value) {
      return;
    }
    editSessionData = value;
  },
});

/**
 * @returns An empty drinking session object.
 */
function getEmptySession(session: Partial<DrinkingSession>): DrinkingSession {
  const emptySession: DrinkingSession = {
    id: session?.id,
    start_time: session?.start_time ?? Date.now(),
    end_time: session?.end_time ?? Date.now(),
    blackout: session?.blackout ?? false,
    note: session?.note ?? '',
    timezone: session?.timezone ?? CONST.DEFAULT_TIME_ZONE.selected,
    type: session?.type ?? CONST.SESSION.TYPES.EDIT,
    ongoing: session?.ongoing,
  };
  return emptySession;
}

/**
 * Check whether a drinking session is empty.
 */
function isEmptySession(session: DrinkingSession): boolean {
  return (
    session.start_time === 0 &&
    session.end_time === 0 &&
    isEmptyObject(session?.drinks) &&
    session.blackout === false &&
    session.note === ''
  );
}

/**
 * Based on the session ID, get the drinking session data.
 *
 * @param sessionId The ID of the session.
 * @returns The drinking session data.
 */
function getDrinkingSessionData(
  sessionId: DrinkingSessionId | undefined,
): DrinkingSession | undefined {
  if (ongoingSessionData && ongoingSessionData.id === sessionId) {
    return ongoingSessionData;
  }
  if (editSessionData && editSessionData.id === sessionId) {
    return editSessionData;
  }
  return undefined;
}

function getDrinkingSessionOnyxKey(
  sessionId: DrinkingSessionId | undefined,
): OnyxKey | null {
  if (!sessionId) {
    return null;
  }
  if (ongoingSessionData && ongoingSessionData.id === sessionId) {
    return ONYXKEYS.ONGOING_SESSION_DATA;
  }
  if (editSessionData && editSessionData.id === sessionId) {
    return ONYXKEYS.EDIT_SESSION_DATA;
  }
  return null;
}

/** Type guard to check if a given key is a valid DrinkType key */
function isDrinkTypeKey(key: string): key is keyof Drinks {
  // eslint-disable-next-line you-dont-need-lodash-underscore/includes
  return _.includes(Object.values(CONST.DRINKS.KEYS), key);
}

/** From a list of drinking sessions, returns an ID of an ongoing session. If there is none, returns null. */
function getOngoingSessionId(
  drinkingSessions: DrinkingSessionList | null | undefined,
): DrinkingSessionId | null {
  if (isEmptyObject(drinkingSessions)) {
    return null;
  }

  const ongoingSessions = Object.entries(drinkingSessions).find(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ([_item, value]) => value?.ongoing === true,
  );

  // if (ongoingSessions.length > 1) {...} // Possibly handle this

  return ongoingSessions ? ongoingSessions[0] : null;
}

/**
 * Calculates the total units of a Drinks object based on a DrinksToUnits mapping.
 *
 * @param drinks - The Drinks object containing drink counts.
 * @param drinksToUnits - A mapping from DrinkKey to unit conversion factors.
 * @param roundUp?: boolean,
 * @returns The total units calculated.
 */
function calculateTotalUnits(
  drinks: DrinksList | undefined,
  drinksToUnits: DrinksToUnits | undefined,
  roundUp?: boolean,
): number {
  if (!drinks || !drinksToUnits) {
    return 0;
  }

  let totalUnits = 0;
  // Iterate over each timestamp in drinksObject
  Object.values(drinks).forEach(drinkTypes => {
    Object.keys(drinkTypes).forEach(DrinkKey => {
      if (!isDrinkTypeKey(DrinkKey)) {
        return;
      }
      const typeDrinks = drinkTypes[DrinkKey] ?? 0;
      const typeUnits = drinksToUnits[DrinkKey] ?? 0;
      totalUnits += typeDrinks * typeUnits;
    });
  });

  if (roundUp) {
    return roundToTwoDecimalPlaces(totalUnits);
  }

  return totalUnits;
}

/**
 * Calculate how many units are available to add based on the current drinks and the drinksToUnits mapping.
 *
 * @param drinks Current drinks
 * @param drinksToUnits The mapping from DrinkKey to unit conversion factors.
 * @returns The number of units available to add
 */
function calculateAvailableUnits(
  drinks: DrinksList | undefined,
  drinksToUnits: DrinksToUnits,
): number {
  const currentUnits = calculateTotalUnits(drinks, drinksToUnits);
  return CONST.MAX_ALLOWED_UNITS - currentUnits;
}

/**
 * Adds a Drinks object to an existing DrinksList object with a specified timestamp behavior.
 * It checks if the total units exceed the maximum allowed units before adding.
 *
 * @param drinkType - The type of drink to add.
 * @param amount - The amount of the drink to add.
 * @param drinksList - The existing DrinksList object.
 * @param drinksToUnits - A mapping from DrinkKey to unit conversion factors.
 * @param options - Options to specify the timestamp behavior.
 * @param maxUnits - The maximum allowed units. Defaults to CONST.MAX_ALLOWED_UNITS.
 * @returns The updated DrinksList object.
 */
function addDrinksToList(
  drinkKey: DrinkKey,
  amount: number,
  drinksList: DrinksList | undefined,
  drinksToUnits: DrinksToUnits,
  options: AddDrinksOptions,
): DrinksList {
  // Create a shallow copy of drinksList to avoid mutating the original
  const updatedDrinksList = drinksList ? {...drinksList} : {};

  if (amount <= 0) {
    Log.warn(`Invalid amount: ${amount}`);
    return updatedDrinksList;
  }

  if (!drinksToUnits[drinkKey]) {
    Log.warn(`Invalid drink key: ${drinkKey}`);
    return updatedDrinksList;
  }

  const availableUnits = calculateAvailableUnits(drinksList, drinksToUnits);
  const newUnits = amount * (drinksToUnits[drinkKey] || 0);
  if (newUnits > availableUnits) {
    // TODO potentially show a warning message to the user
    Log.warn('Total units exceed the maximum allowed units. Drinks not added.');
    return updatedDrinksList;
  }

  let timestamp: number;

  if (options.timestampOption === 'now') {
    timestamp = Date.now();
  } else if (options.timestampOption === 'sessionEndTime') {
    timestamp = options.end_time;
  } else if (options.timestampOption === 'sessionStartTime') {
    timestamp = options.start_time;
  } else {
    throw new Error('Invalid timestampOption');
  }

  if (updatedDrinksList[timestamp]) {
    // Timestamp already exists, merge the drinks
    const existingDrinks = updatedDrinksList[timestamp];
    const mergedDrinks: Drinks = {...existingDrinks};

    mergedDrinks[drinkKey] = (mergedDrinks[drinkKey] ?? 0) + (amount ?? 0);

    updatedDrinksList[timestamp] = mergedDrinks;
  } else {
    // Timestamp does not exist, add the drinks
    updatedDrinksList[timestamp] = {[drinkKey]: amount};
  }

  return updatedDrinksList;
}

/**
 * Removes drinks from a DrinksList based on the specified behavior.
 *
 * @param drinkKey - The drink key to remove.
 * @param amount - The number of drinks to remove.
 * @param drinksList - The existing DrinksList from which to remove drinks.
 * @param options - The behavior for removal ('removeFromLatest' or 'removeFromEarliest').
 * @returns The updated DrinksList after removal.
 */
function removeDrinksFromList(
  drinkKey: DrinkKey,
  amount: number,
  drinksList: DrinksList | undefined,
  options: RemoveDrinksOptions,
): DrinksList {
  if (!drinksList) {
    return {};
  }

  if (amount <= 0) {
    Log.warn(`Invalid amount: ${amount}`);
    return drinksList;
  }

  const updatedDrinksList: DrinksList = _.cloneDeep(drinksList);

  let remainingAmountToRemove = amount ?? 0;

  for (const timestamp of Object.keys(updatedDrinksList).sort((a, b) =>
    options === 'removeFromLatest' ? +b - +a : +a - +b,
  )) {
    const drinksAtTimestamp = updatedDrinksList[+timestamp];
    const avaiableAmount = drinksAtTimestamp[drinkKey] ?? 0;

    if (avaiableAmount > 0) {
      const amountRemoved = Math.min(remainingAmountToRemove, avaiableAmount);

      drinksAtTimestamp[drinkKey] = avaiableAmount - amountRemoved;
      remainingAmountToRemove -= amountRemoved;

      // Clean up if there are zero drinks left for this type at this timestamp
      if (drinksAtTimestamp[drinkKey] === 0) {
        delete drinksAtTimestamp[drinkKey];
      }

      // Clean up if there are zero drinks left at this timestamp
      if (Object.keys(drinksAtTimestamp).length === 0) {
        delete updatedDrinksList[+timestamp];
      }
    }

    if (remainingAmountToRemove <= 0) {
      break;
    }
  }
  return updatedDrinksList;
}

/**
 * Get the options for adding drinks to a session based on the session state.
 *
 * @param session The session to add drinks to
 * @returns The options for adding drinks
 */
function getSessionAddDrinksOptions(
  session: DrinkingSession,
): AddDrinksOptions {
  if (session?.ongoing) {
    return {
      timestampOption: 'now',
    };
  }

  if (session?.type === CONST.SESSION.TYPES.LIVE && session?.end_time) {
    return {
      timestampOption: 'sessionEndTime',
      end_time: session.end_time,
    };
  }

  return {
    timestampOption: 'sessionStartTime',
    start_time: session.start_time,
  };
}

function getSessionRemoveDrinksOptions(): RemoveDrinksOptions {
  return 'removeFromLatest';
}

/**
 * Modify the drinks in a session based on the action.
 *
 * @param session The session to modify
 * @param drinkKey The key of the drink to modify
 * @param amount The amount of the drink to modify
 * @param drinksToUnits The mapping from drink keys to units
 * @param action The action to perform
 * @returns The updated drinks list
 */
function modifySessionDrinks(
  session: DrinkingSession,
  drinkKey: DrinkKey,
  amount: number,
  action: ValueOf<typeof CONST.DRINKS.ACTIONS>,
  drinksToUnits: DrinksToUnits,
): DrinksList | undefined {
  let drinksList = _.cloneDeep(session?.drinks);
  if (action === 'add') {
    const options: AddDrinksOptions = getSessionAddDrinksOptions(session);
    drinksList = addDrinksToList(
      drinkKey,
      amount,
      drinksList,
      drinksToUnits,
      options,
    );
  } else if (action === 'remove') {
    const options: RemoveDrinksOptions = 'removeFromLatest';
    drinksList = removeDrinksFromList(drinkKey, amount, drinksList, options);
  }

  return drinksList;
}

function sessionIsExpired(session: DrinkingSession | undefined): boolean {
  if (!session) {
    return false;
  }
  const expirationBoundary = Date.now() - CONST.SESSION_EXPIRY;
  return session.start_time < expirationBoundary;
}

/** Calculate a length of a sesison either as a number, or as a string */
function calculateSessionLength(
  session: DrinkingSession | undefined,
  returnString?: boolean,
): number | string {
  if (!session) {
    return returnString ? '0s' : 0;
  }
  const length = session?.end_time ? session.end_time - session.start_time : 0;
  if (returnString) {
    return numberToVerboseString(length, false);
  }
  return length;
}

/**
 * From a list of drinking sessions, extract a single session object.
 * If the list does not contain the session, return an empty session.
 */
function extractSessionOrEmpty(
  sessionId: DrinkingSessionId,
  drinkingSessionData: DrinkingSessionList | undefined,
): DrinkingSession {
  if (isEmptyObject(drinkingSessionData)) {
    return getEmptySession({});
  }
  if (
    drinkingSessionData &&
    Object.keys(drinkingSessionData).includes(sessionId)
  ) {
    return drinkingSessionData[sessionId];
  }
  return getEmptySession({});
}

/** Given a DrinkingSession object, determine its type (i.e.,
 *  the most number of units the user has in this session).
 *
 * If there are no drinks in the session, return null.
 * */
function determineSessionMostCommonDrink(
  session: DrinkingSession | undefined | null,
): DrinkKey | undefined | null {
  if (!session) {
    return null;
  }
  const drinks = session.drinks;
  if (!drinks) {
    return null;
  }
  const drinkCounts: Partial<Record<DrinkKey, number>> = {};

  Object.values(drinks).forEach(drinksAtTimestamp => {
    Object.entries(drinksAtTimestamp).forEach(([drinkKey, count]) => {
      if (!count) {
        return;
      }
      const key = drinkKey as DrinkKey; // Initialize safely
      // Increment the count, initializing to 0 if necessary
      drinkCounts[key] = (drinkCounts[key] ?? 0) + count;
    });
  });

  // Find the drink with the highest count
  let mostCommonDrink: DrinkKey | null = null;
  let highestCount = 0;
  let isTie = false;
  Object.entries(drinkCounts).forEach(([drinkKey, count]) => {
    if (!count) {
      return;
    }
    if (count > highestCount) {
      highestCount = count;
      mostCommonDrink = drinkKey as DrinkKey;
      isTie = false; // Reset the tie flag as we have a new leader
    } else if (count === highestCount) {
      isTie = true; // A tie has occurred
    }
  });

  // In case of no single winner, return 'other'
  if (isTie && highestCount > 0) {
    return CONST.DRINKS.KEYS.OTHER;
  }

  return mostCommonDrink;
}

/** Subset an array of drinking sessions to a single day.
 *
 * @param dateObject Date type object for whose day to subset the sessions to
 * @param sessions An array of sessions to subset
 * @param returnArray If true, return an array of sessions without IDs. If false,
 *  simply subset the drinking session list to the relevant sessions.
 * @returns The subsetted array of sessions
 */
function getSingleDayDrinkingSessions(
  date: Date,
  sessions: DrinkingSessionList | undefined,
  returnArray = true,
): DrinkingSessionArray | DrinkingSessionList {
  if (!sessions) {
    return returnArray ? [] : {};
  }

  const baseTimezone = timezone.selected;
  const timezoneCache: Record<
    string,
    {startOfDayUTC: number; endOfDayUTC: number}
  > = {};

  const sessionBelongsToDate = (session: DrinkingSession) => {
    const tz = session.timezone ?? baseTimezone;

    // Cache the start and end of day UTC timestamps per timezone
    if (!timezoneCache[tz]) {
      timezoneCache[tz] = DateUtils.getDayStartAndEndUTC(date, tz);
    }

    const {startOfDayUTC, endOfDayUTC} = timezoneCache[tz];
    const sessionStartTime = session.start_time; // UTC timestamp in milliseconds

    // Directly compare UTC timestamps
    return sessionStartTime >= startOfDayUTC && sessionStartTime <= endOfDayUTC;
  };

  const filteredSessions = returnArray
    ? Object.values(sessions).filter(sessionBelongsToDate)
    : Object.fromEntries(
        Object.entries(sessions).filter(([, session]) =>
          sessionBelongsToDate(session),
        ),
      );

  return filteredSessions;
}

/** Subset an array of drinking sessions to the current month only.
 *
 * @param date Date type object for whose month to subset the sessions to
 * @param sessions An array of sessions to subset
 * @param untilToday If true, include no sessions that occured after today
 * @returns The subsetted array of sessions
 */
function getSingleMonthDrinkingSessions(
  date: Date,
  sessions: DrinkingSessionArray,
  untilToday = false,
): DrinkingSessionArray {
  const baseTimezone = timezone.selected;
  const timezoneCache: Record<
    string,
    {startOfMonthUTC: number; endOfMonthUTC: number}
  > = {};

  const sessionBelongsToMonth = (session: DrinkingSession) => {
    const tz = session.timezone ?? baseTimezone;

    // Cache the start and end of month UTC timestamps per timezone
    if (!timezoneCache[tz]) {
      timezoneCache[tz] = DateUtils.getMonthStartAndEndUTC(
        date,
        tz,
        untilToday,
      );
    }

    const {startOfMonthUTC, endOfMonthUTC} = timezoneCache[tz];
    const sessionStartTime = session.start_time; // Assuming it's a UTC timestamp in milliseconds

    // Directly compare UTC timestamps
    return (
      sessionStartTime >= startOfMonthUTC && sessionStartTime <= endOfMonthUTC
    );
  };

  const filteredSessions = sessions.filter(sessionBelongsToMonth);
  return filteredSessions;
}
/**
 * Get the displayName for a single session participant.
 */
function getDisplayNameForParticipant(
  userID?: UserID,
  // shouldUseShortForm = false,
  // shouldFallbackToHidden = true,
  // shouldAddCurrentUserPostfix = false,
): string {
  if (!userID) {
    return '';
  }
  return 'not-yet-implemented'; // TODO implement this

  // const personalDetails = getUserDataForUserID(userID);
  // // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  // const formattedLogin = LocalePhoneNumber.formatPhoneNumber(
  //   personalDetails.login || '',
  // );
  // // This is to check if account is an invite/optimistically created one
  // // and prevent from falling back to 'Hidden', so a correct value is shown
  // // when searching for a new user
  // if (personalDetails.isOptimisticPersonalDetail === true) {
  //   return formattedLogin;
  // }

  // // For selfDM, we display the user's displayName followed by '(you)' as a postfix
  // const shouldAddPostfix =
  //   shouldAddCurrentUserPostfix && userID === currentUserID;

  // const longName = UserDataUtils.getDisplayNameOrDefault(
  //   personalDetails,
  //   formattedLogin,
  //   shouldFallbackToHidden,
  //   shouldAddPostfix,
  // );

  // // If the user's personal details (first name) should be hidden, make sure we return "hidden" instead of the short name
  // if (
  //   shouldFallbackToHidden &&
  //   longName === Localize.translateLocal('common.hidden')
  // ) {
  //   return longName;
  // }

  // const shortName = personalDetails.firstName
  //   ? personalDetails.firstName
  //   : longName;
  // return shouldUseShortForm ? shortName : longName;
}

/**
 * Returns the the display names of the given user accountIDs
 */
function getUserDetailTooltipText(
  accountID: UserID,
  fallbackUserDisplayName = '',
): string {
  const displayNameForParticipant = getDisplayNameForParticipant(accountID);
  return displayNameForParticipant || fallbackUserDisplayName;
}

/**
 * Determine whether the given session is on a different day when converted to the given timezone.
 *
 * @param session The session to check
 * @param timezone The timezone to convert the session to
 * @returns Whether the session is on a different day
 */
function isDifferentDay(
  session: DrinkingSession,
  tz: SelectedTimezone,
): boolean {
  const stringFormat = 'yyyy-MM-dd';
  const start_time = session.start_time;
  let currentDay: string;
  if (session.timezone) {
    currentDay = formatInTimeZone(start_time, session.timezone, stringFormat);
  } else {
    currentDay = format(start_time, stringFormat);
  }
  const newDay = formatInTimeZone(session.start_time, tz, stringFormat);
  return currentDay !== newDay;
}

/**
 * Get the date on which a user started tracking their alcohol consumption / drinking sessions
 *
 * @param drinkingSessionsData The user's drinking session data
 * @returns [Date | null]
 */
function getUserTrackingStartDate(
  data: DrinkingSessionList | undefined | null,
): Date | null {
  if (isEmptyObject(data)) {
    return null;
  }
  const startTimes = Object.values(data).map(session => session.start_time);

  const earliestTimestamp = _.min(startTimes);
  if (!earliestTimestamp) {
    return null;
  }

  return new Date(earliestTimestamp);
}

/**
 * Check if all sessions contain a timezone.
 *
 * @param sessions The list of drinking sessions to check
 * @returns Whether all sessions contain a timezone
 */
function allSessionsContainTimezone(sessions?: DrinkingSessionList): boolean {
  if (isEmptyObject(sessions)) {
    return true; // No session to fix
  }

  return Object.values(sessions).every(
    session => 'timezone' in session && session.timezone,
  );
}

/**
 * Modify all timestamps of a drinking session and return the updated session
 *
 * @param session The session to update
 * @param millisecondsToSub How many milliseconds to subtract the timestamps by
 */
function shiftSessionTimestamps(
  session: DrinkingSession,
  millisecondsToSub: number,
): DrinkingSession {
  if (millisecondsToSub === 0) {
    return session;
  }
  const convertedSession = {...session};
  convertedSession.start_time = subMilliseconds(
    session.start_time,
    millisecondsToSub,
  ).getTime();
  if (session.end_time) {
    convertedSession.end_time = subMilliseconds(
      session.end_time,
      millisecondsToSub,
    ).getTime();
  }

  const convertedDrinks: DrinksList = {};
  const existingTimestamps = new Set<number>();

  if (!isEmptyObject(session.drinks)) {
    Object.entries(session.drinks).forEach(([timestamp, drinksAtTimestamp]) => {
      let newTimestamp = subMilliseconds(
        Number(timestamp),
        millisecondsToSub,
      ).getTime();

      // Ensure the new timestamp is unique by checking for collisions
      while (existingTimestamps.has(newTimestamp)) {
        newTimestamp += 1; // Increment timestamp slightly to avoid collision
      }

      existingTimestamps.add(newTimestamp);
      convertedDrinks[newTimestamp] = drinksAtTimestamp;
    });

    convertedSession.drinks = convertedDrinks;
  }

  return convertedSession;
}

async function fixTimezoneSessions(
  db: Database,
  userID: UserID | undefined,
  sessions: DrinkingSessionList | undefined,
  tz: SelectedTimezone,
) {
  if (!userID) {
    throw new Error('Invalid user. Try reloading the app.');
  }
  if (isEmptyObject(sessions)) {
    return;
  }
  const convertedSessions: DrinkingSessionList = {};
  Object.entries(sessions).forEach(([sessionId, session]) => {
    const convertedSession = {...session};
    if (!convertedSession.timezone) {
      convertedSession.timezone = tz;
    }

    if ('session_type' in session) {
      convertedSession.type = session.session_type as DrinkingSessionType;
      delete convertedSession.session_type;
    }

    convertedSessions[sessionId] = convertedSession;
  });

  // We flag the sessions with the TZ the user chose, but for the app, we automatically assign the automatic timezone
  const userTimezone: Timezone = {
    selected: Intl.DateTimeFormat().resolvedOptions()
      .timeZone as SelectedTimezone,
    automatic: true,
  };

  const sessionsRef = DBPATHS.USER_DRINKING_SESSIONS_USER_ID;
  const timezoneRef = DBPATHS.USERS_USER_ID_TIMEZONE;

  const updates: Record<string, DrinkingSessionList | Timezone> = {};
  updates[sessionsRef.getRoute(userID)] = convertedSessions;
  updates[timezoneRef.getRoute(userID)] = userTimezone;

  await update(ref(db), updates);
}

/** Based on a session type, return the icon that should be associated with this session */
function getIconForSession(
  sessionType: DrinkingSessionType | undefined,
): IconAsset | ImageSourcePropType {
  switch (sessionType) {
    case CONST.SESSION.TYPES.LIVE:
      return KirokuIcons.Stopwatch;
    case CONST.SESSION.TYPES.EDIT:
      return KirokuIcons.Edit;
    default:
      return KirokuIcons.AlcoholAssortment;
  }
}

function isRealtimeSession(type: DrinkingSessionType): boolean {
  return type in CONST.SESSION.REALTIME;
}

function getSessionTypeTitle(
  sessionType: DrinkingSessionType,
): TranslationPaths {
  switch (sessionType) {
    case CONST.SESSION.TYPES.LIVE:
      return 'drinkingSession.live.title';
    case CONST.SESSION.TYPES.EDIT:
      return 'drinkingSession.edit.title';
    default:
      return 'common.unknown';
  }
}

/** Return a description for a session type */
function getSessionTypeDescription(
  sessionType: DrinkingSessionType,
): TranslationPaths {
  switch (sessionType) {
    case CONST.SESSION.TYPES.LIVE:
      return 'drinkingSession.live.description';
    case CONST.SESSION.TYPES.EDIT:
      return 'drinkingSession.edit.description';
    default:
      return 'common.unknown';
  }
}

export {
  PlaceholderDrinks,
  addDrinksToList,
  allSessionsContainTimezone,
  calculateAvailableUnits,
  calculateSessionLength,
  calculateTotalUnits,
  determineSessionMostCommonDrink,
  extractSessionOrEmpty,
  fixTimezoneSessions,
  getDisplayNameForParticipant,
  getDrinkingSessionData,
  getDrinkingSessionOnyxKey,
  getEmptySession,
  getIconForSession,
  getOngoingSessionId,
  getSessionAddDrinksOptions,
  getSessionRemoveDrinksOptions,
  getSessionTypeDescription,
  getSessionTypeTitle,
  getSingleDayDrinkingSessions,
  getSingleMonthDrinkingSessions,
  getUserDetailTooltipText,
  getUserTrackingStartDate,
  isDifferentDay,
  isDrinkTypeKey,
  isEmptySession,
  isRealtimeSession,
  modifySessionDrinks,
  removeDrinksFromList,
  sessionIsExpired,
  shiftSessionTimestamps,
};
