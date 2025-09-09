import type {DrinkKey, DrinksList, DrinksToUnits} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import CONST from '@src/CONST';
import DateUtils from '@libs/DateUtils';
import type {DayRollup} from './types';

/**
 * Builds day rollups for a given drinks list and drinks to units mapping.
 *
 * @param drinks - The drinks list to build rollups for.
 * @param drinksToUnits - The drinks to units mapping.
 * @param userId - The user id to build rollups for.
 * @returns The day rollups.
 */
function buildDayRollups(
  drinks: DrinksList,
  drinksToUnits: DrinksToUnits,
  userId: UserID,
): DayRollup[] {
  const byKey = new Map<string, DayRollup>();

  for (const [timestamp, drinksObject] of Object.entries(drinks)) {
    const dayKey = DateUtils.getLocalizedDay(
      timestamp,
      undefined,
      CONST.DATE.FNS_FORMAT_STRING,
    );
    const key = `${userId}__${dayKey}`;
    for (const [drinkKey, drinkValue] of Object.entries(drinksObject)) {
      // Could use sduFrom here
      const sdu = drinksToUnits[drinkKey as DrinkKey] * drinkValue;

      let row = byKey.get(key);
      if (!row) {
        row = {
          userId,
          dateKey: dayKey,
          totalSdu: 0,
          drinksCount: 0,
          byType: {},
        };
        byKey.set(key, row);
      }

      row.totalSdu += sdu;
      row.drinksCount += 1;
      row.byType[drinkKey as DrinkKey] =
        (row.byType[drinkKey as DrinkKey] ?? 0) + sdu;

      const localTs = DateUtils.getLocalizedTime(
        timestamp,
        undefined,
        CONST.DATE.FNS_TIMEZONE_FORMAT_STRING,
      );

      row.firstTs = (row.firstTs ?? localTs) < localTs ? row.firstTs : localTs;
      row.lastTs = (row.lastTs ?? localTs) > localTs ? row.lastTs : localTs;
    }
  }

  return [...byKey.values()].map(r => ({
    ...r,
    totalSdu: +r.totalSdu.toFixed(2),
  }));
}

// eslint-disable-next-line import/prefer-default-export
export {buildDayRollups};
