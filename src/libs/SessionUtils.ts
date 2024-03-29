import CONST from '@src/CONST';
import {
  DrinkingSession,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkingSessionType,
  DrinksList,
} from '@src/types/database';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import {getTimestampAge, numberToVerboseString} from './TimeUtils';

const PlaceholderDrinks: DrinksList = {[Date.now()]: {other: 0}};

/**
 * @returns An empty drinking session object.
 */
function getEmptySession(
  type?: DrinkingSessionType,
  usePlaceholderDrinks?: boolean,
  ongoing?: boolean,
): DrinkingSession {
  let emptySession: DrinkingSession = {
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
  if (!session) return false;
  const expirationBoundary = Date.now() - CONST.SESSION_EXPIRY;
  return session.start_time < expirationBoundary;
}

/** Calculate a length of a sesison either as a number, or as a string */
function calculateSessionLength(
  session: DrinkingSession | undefined,
  returnString?: boolean,
): number | string {
  if (!session) return returnString ? '0s' : 0;
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
  if (isEmptyObject(drinkingSessionData)) return getEmptySession();
  if (
    drinkingSessionData &&
    Object.keys(drinkingSessionData).includes(sessionId)
  ) {
    return drinkingSessionData[sessionId];
  }
  return getEmptySession();
}

export {
  PlaceholderDrinks,
  calculateSessionLength,
  extractSessionOrEmpty,
  sessionIsExpired,
  getEmptySession,
  isEmptySession,
};
