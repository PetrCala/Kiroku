import CONST from '@src/CONST';
import type {
  DrinkingSession,
  DrinkingSessionList,
  DrinkKey,
} from '@src/types/onyx';
import {getDrinkCount} from './DrinkEntryUtils';
import {isDrinkTypeKey} from './DrinkingSessionUtils';

/** How many drinks the Home live card offers for quick-add. */
const USUAL_DRINKS_COUNT = 3;

/**
 * Only the most recent sessions count, so the picks follow what the user
 * drinks these days rather than years ago.
 */
const USUAL_DRINKS_SESSION_WINDOW = 30;

/**
 * Fills the remaining slots when the history is thin (a new user, or someone
 * who only ever logs one kind of drink): the everyday picks, in that order.
 */
const FALLBACK_USUAL_DRINKS: DrinkKey[] = [
  CONST.DRINKS.KEYS.BEER,
  CONST.DRINKS.KEYS.WINE,
  CONST.DRINKS.KEYS.STRONG_SHOT,
];

const DRINK_KEY_ORDER: DrinkKey[] = Object.values(CONST.DRINKS.KEYS);

/**
 * The drinks a user logs most, for quick-add: ranked by how many they logged
 * across their most recent sessions, then topped up from a fixed fallback so
 * there are always `count` distinct picks. Ties keep the app's drink order.
 */
function getUsualDrinkKeys(
  sessions: DrinkingSessionList | undefined,
  count = USUAL_DRINKS_COUNT,
): DrinkKey[] {
  const recentSessions = Object.values(sessions ?? {})
    .filter((session): session is DrinkingSession => !!session)
    .sort((a, b) => b.start_time - a.start_time)
    .slice(0, USUAL_DRINKS_SESSION_WINDOW);

  const totals = new Map<DrinkKey, number>();
  recentSessions.forEach(session => {
    Object.values(session.drinks ?? {}).forEach(drinksAtTimestamp => {
      Object.entries(drinksAtTimestamp ?? {}).forEach(([key, entry]) => {
        if (!isDrinkTypeKey(key)) {
          return;
        }
        const drinkCount = getDrinkCount(entry);
        if (drinkCount > 0) {
          totals.set(key, (totals.get(key) ?? 0) + drinkCount);
        }
      });
    });
  });

  const ranked = [...totals.keys()].sort(
    (a, b) =>
      (totals.get(b) ?? 0) - (totals.get(a) ?? 0) ||
      DRINK_KEY_ORDER.indexOf(a) - DRINK_KEY_ORDER.indexOf(b),
  );

  const picks = ranked.slice(0, count);
  FALLBACK_USUAL_DRINKS.forEach(drinkKey => {
    if (picks.length < count && !picks.includes(drinkKey)) {
      picks.push(drinkKey);
    }
  });
  return picks;
}

export default getUsualDrinkKeys;
export {FALLBACK_USUAL_DRINKS, USUAL_DRINKS_COUNT, USUAL_DRINKS_SESSION_WINDOW};
