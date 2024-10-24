import CONST from '@src/CONST';
import type {
  DrinkKey,
  DrinkingSession,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkingSessionType,
  DrinksList,
} from '@src/types/onyx';
import {ref, update, type Database} from 'firebase/database';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import {getTimestampAge, numberToVerboseString} from './TimeUtils';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import * as Localize from './Localize';
import {SelectedTimezone} from '@src/types/onyx/PersonalDetails';
import {utcToZonedTime, zonedTimeToUtc} from 'date-fns-tz';
import DBPATHS from '@database/DBPATHS';

const PlaceholderDrinks: DrinksList = {[Date.now()]: {other: 0}};

/**
 * @returns An empty drinking session object.
 */
function getEmptySession(
  type?: DrinkingSessionType,
  usePlaceholderDrinks?: boolean,
  ongoing?: boolean,
): DrinkingSession {
  const emptySession: DrinkingSession = {
    start_time: Date.now(),
    end_time: Date.now(),
    drinks: usePlaceholderDrinks ? PlaceholderDrinks : {},
    blackout: false,
    note: '',
    type: type ?? CONST.SESSION_TYPES.EDIT,
    ...(ongoing && {ongoing: true}),
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
    return getEmptySession();
  }
  if (
    drinkingSessionData &&
    Object.keys(drinkingSessionData).includes(sessionId)
  ) {
    return drinkingSessionData[sessionId];
  }
  return getEmptySession();
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
      if (count) {
        const key = drinkKey as DrinkKey; // Initialize safely
        // Increment the count, initializing to 0 if necessary
        drinkCounts[key] = (drinkCounts[key] || 0) + count;
      }
    });
  });

  // Find the drink with the highest count
  let mostCommonDrink: DrinkKey | null = null;
  let highestCount = 0;
  let isTie = false;
  Object.entries(drinkCounts).forEach(([drinkKey, count]) => {
    if (count) {
      if (count > highestCount) {
        highestCount = count;
        mostCommonDrink = drinkKey as DrinkKey;
        isTie = false; // Reset the tie flag as we have a new leader
      } else if (count === highestCount) {
        isTie = true; // A tie has occurred
      }
    }
  });

  // In case of no single winner, return 'other'
  if (isTie && highestCount > 0) {
    return CONST.DRINKS.KEYS.OTHER;
  }

  return mostCommonDrink;
}

/**
 * Get the displayName for a single session participant.
 */
function getDisplayNameForParticipant(
  userID?: UserID,
  shouldUseShortForm = false,
  shouldFallbackToHidden = true,
  shouldAddCurrentUserPostfix = false,
): string {
  if (!userID) {
    return '';
  }
  return 'not-yet-implemented'; // TODO implement this

  // const personalDetails = getPersonalDetailsForUserID(userID);
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

  // const longName = PersonalDetailsUtils.getDisplayNameOrDefault(
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
 * Returns the the display names of the given user userIDs
 */
function getUserDetailTooltipText(
  userID: UserID,
  fallbackUserDisplayName = '',
): string {
  const displayNameForParticipant = getDisplayNameForParticipant(userID);
  return displayNameForParticipant || fallbackUserDisplayName;
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

/** Modify a timestamp so that it points to the same day in UTC midday.
 */
function fixEditSessionTimestamp(
  timestamp: number,
  timezone: SelectedTimezone,
): number {
  const utcTimestamp = zonedTimeToUtc(timestamp, timezone).getTime();
  const utcDate = new Date(utcTimestamp);

  const localizedDate = utcToZonedTime(utcDate, timezone);

  return Date.UTC(
    localizedDate.getFullYear(),
    localizedDate.getMonth(),
    localizedDate.getDay(),
    12,
    0,
    0,
    0,
  );
}

// A temporary function to convert all sessions to UTC
function convertSessionsToUtc(
  sessions: DrinkingSessionList,
  timezone: SelectedTimezone,
): DrinkingSessionList {
  const convertedSessions: DrinkingSessionList = {};
  Object.entries(sessions).forEach(([sessionId, session]) => {
    const convertedSession = {...session};
    if (!convertedSession.timezone) {
      convertedSession.timezone = timezone;
    }
    const convertedDrinks: DrinksList = {};
    const existingTimestamps = new Set<number>();

    if (!isEmptyObject(session.drinks)) {
      Object.entries(session.drinks).forEach(
        ([timestamp, drinksAtTimestamp]) => {
          let newTimestamp = zonedTimeToUtc(
            Number(timestamp),
            timezone,
          ).getTime();

          // Ensure the new timestamp is unique by checking for collisions
          while (existingTimestamps.has(newTimestamp)) {
            newTimestamp += 1; // Increment timestamp slightly to avoid collision
          }

          existingTimestamps.add(newTimestamp);
          convertedDrinks[newTimestamp] = drinksAtTimestamp;
        },
      );

      convertedSession.drinks = convertedDrinks;
    }

    if ('session_type' in session) {
      convertedSession.type = session.session_type as DrinkingSessionType;
      delete convertedSession.session_type;
    }

    const shouldFixTimestamp =
      session.type === 'edit' || session?.session_type === 'edit'; // @ts-ignore

    const newStartTime = shouldFixTimestamp
      ? fixEditSessionTimestamp(session.start_time, timezone)
      : zonedTimeToUtc(session.start_time, timezone).getTime();
    const newEndTime = shouldFixTimestamp
      ? fixEditSessionTimestamp(session.end_time, timezone)
      : zonedTimeToUtc(session.end_time, timezone).getTime();

    convertedSession.start_time = newStartTime;
    convertedSession.end_time = newEndTime;

    convertedSessions[sessionId] = convertedSession;
  });
  return convertedSessions;
}

async function fixTimezoneSessions(
  db: Database,
  userID: UserID | undefined,
  sessions: DrinkingSessionList | undefined,
  timezone: SelectedTimezone,
) {
  if (!userID) {
    throw new Error('Invalid user. Try reloading the app.');
  }
  if (isEmptyObject(sessions)) {
    return;
  }
  const convertedSessions = convertSessionsToUtc(sessions, timezone);

  const sessionsRef = DBPATHS.USER_DRINKING_SESSIONS_USER_ID;

  const updates: Record<string, DrinkingSessionList> = {};
  updates[sessionsRef.getRoute(userID)] = convertedSessions;

  await update(ref(db), updates);
}

const DSUtils = {
  PlaceholderDrinks,
  allSessionsContainTimezone,
  calculateSessionLength,
  determineSessionMostCommonDrink,
  extractSessionOrEmpty,
  fixEditSessionTimestamp,
  getDisplayNameForParticipant,
  getEmptySession,
  getUserDetailTooltipText,
  isEmptySession,
  sessionIsExpired,
  fixTimezoneSessions,
};

export default DSUtils;
