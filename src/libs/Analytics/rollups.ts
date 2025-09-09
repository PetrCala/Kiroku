import type {DrinkKey, DrinksList, DrinksToUnits} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {DrinkingSessionList} from '@src/types/onyx/DrinkingSession';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import DateUtils from '@libs/DateUtils';
import Onyx from 'react-native-onyx';
import type {Timezone} from '@src/types/onyx/UserData';
import {auth} from '@libs/Firebase/FirebaseApp';
import type {DayRollup} from './types';

let timezone: Required<Timezone> = CONST.DEFAULT_TIME_ZONE;
Onyx.connect({
  key: ONYXKEYS.USER_DATA_LIST,
  callback: value => {
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

  for (const [tsStr, drinksObject] of Object.entries(drinks)) {
    const tsNum = Number(tsStr);
    if (Number.isNaN(tsNum)) {
      // invalid timestamp, skip
    } else {
      const dayKey = DateUtils.getLocalizedDay(
        tsNum,
        timezone.selected,
        CONST.DATE.FNS_FORMAT_STRING,
      );

      if (dayKey && dayKey !== 'unknown') {
        const localTs = DateUtils.getLocalizedTime(
          tsNum,
          timezone.selected,
          CONST.DATE.FNS_TIMEZONE_FORMAT_STRING,
        );
        const hasLocalTs = !!localTs && localTs !== 'unknown';

        const key = `${userId}__${dayKey}`;
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

        for (const [drinkKey, rawValue] of Object.entries(drinksObject)) {
          const amount = Number(rawValue);
          const unitMultiplier = drinksToUnits[drinkKey as DrinkKey];

          if (Number.isFinite(amount) && amount > 0 && unitMultiplier != null) {
            const sdu = unitMultiplier * amount;

            row.totalSdu += sdu;
            row.drinksCount += 1;
            row.byType[drinkKey as DrinkKey] =
              (row.byType[drinkKey as DrinkKey] ?? 0) + sdu;

            if (hasLocalTs) {
              row.firstTs =
                row.firstTs && row.firstTs < localTs ? row.firstTs : localTs;
              row.lastTs =
                row.lastTs && row.lastTs > localTs ? row.lastTs : localTs;
            }
          }
        }
      }
    }
  }

  return [...byKey.values()].map(r => ({
    ...r,
    totalSdu: Number(r.totalSdu.toFixed(2)),
  }));
}

/**
 * Builds day rollups from drinking session data.
 * This is a convenience function that combines data transformation and rollup building.
 *
 * @param drinkingSessions - The drinking sessions data.
 * @param drinksToUnits - The drinks to units mapping.
 * @param userId - The user ID to build rollups for.
 * @returns The day rollups.
 */
function buildDayRollupsFromSessions(
  drinkingSessions: DrinkingSessionList | undefined,
  drinksToUnits: DrinksToUnits,
  userId: UserID,
): DayRollup[] {
  const drinksList =
    DSUtils.transformDrinkingSessionsToDrinksList(drinkingSessions);
  return buildDayRollups(drinksList, drinksToUnits, userId);
}

export {buildDayRollups, buildDayRollupsFromSessions};
