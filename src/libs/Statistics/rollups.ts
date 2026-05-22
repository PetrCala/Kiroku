import {formatInTimeZone} from 'date-fns-tz';
import type {DrinkingSessionList} from '@src/types/onyx/DrinkingSession';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {DayRollup} from './types';

/**
 * Build per-day aggregations from a user's drinking sessions.
 *
 * Pure: timezone is passed in (no module-mutable global, no Onyx import).
 * Iterates session structure directly — per-drink timestamps are honored,
 * not collapsed to `session.start_time`. Sessions still `ongoing` are
 * excluded.
 */
function buildDayRollups(
  sessions: DrinkingSessionList | undefined,
  drinksToUnits: DrinksToUnits | undefined,
  timezone: SelectedTimezone,
  userId: UserID,
): DayRollup[] {
  if (!sessions || !drinksToUnits) {
    return [];
  }

  const byDayKey = new Map<string, DayRollup>();

  for (const session of Object.values(sessions)) {
    if (!session || session.ongoing === true) {
      continue;
    }

    // A session may carry its own timezone (user travelled). Fall back to
    // the viewer's timezone when missing.
    const sessionTz = session.timezone ?? timezone;
    const drinks = session.drinks;
    if (!drinks || typeof drinks !== 'object') {
      continue;
    }

    for (const [tsStr, drinksObject] of Object.entries(drinks)) {
      const tsNum = Number(tsStr);
      if (
        !Number.isFinite(tsNum) ||
        !drinksObject ||
        typeof drinksObject !== 'object'
      ) {
        continue;
      }

      let dayKey: string;
      try {
        dayKey = formatInTimeZone(tsNum, sessionTz, 'yyyy-MM-dd');
      } catch {
        continue;
      }

      const rowKey = `${userId}__${dayKey}`;
      let row = byDayKey.get(rowKey);

      for (const [drinkKeyStr, rawValue] of Object.entries(drinksObject)) {
        const drinkKey = drinkKeyStr as DrinkKey;
        const amount = Number(rawValue);
        const unitMultiplier = drinksToUnits[drinkKey];

        if (!Number.isFinite(amount) || amount <= 0 || unitMultiplier == null) {
          continue;
        }

        if (!row) {
          row = {
            userId,
            dateKey: dayKey,
            totalSdu: 0,
            drinksCount: 0,
            byType: {},
          };
          byDayKey.set(rowKey, row);
        }

        const sdu = unitMultiplier * amount;
        row.totalSdu += sdu;
        row.drinksCount += 1;
        row.byType[drinkKey] = (row.byType[drinkKey] ?? 0) + sdu;
      }
    }
  }

  return [...byDayKey.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map(r => ({...r, totalSdu: Number(r.totalSdu.toFixed(2))}));
}

export default buildDayRollups;
