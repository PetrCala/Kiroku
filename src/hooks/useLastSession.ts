import {useMemo} from 'react';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import {timestampToDateString} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import getRelativeDayTier from '@libs/getRelativeDayTier';
import type {DrinkingSessionId} from '@src/types/onyx/DrinkingSession';
import type {DateString} from '@src/types/onyx/OnyxCommon';

type LastSessionView = {
  /** Collection key of the session, for single-session summary navigation. */
  sessionId: DrinkingSessionId;
  /** Day-granularity relative time, e.g. "Today", "Yesterday", "3 days ago". */
  when: string;
  /** Formatted total units, e.g. "4.5". */
  units: string;
  /** `yyyy-MM-dd` of the session, for day-overview navigation. */
  dateString: DateString;
};

function formatUnits(value: number): string {
  // 1 decimal for partial units, else integer — the app-wide units norm.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * The user's most recent COMPLETED session, formatted for the home "last
 * session" banner. `null` when there is no completed session (brand-new user,
 * or only an ongoing session) — the caller renders no banner in that case.
 *
 * Relative time is rounded to whole days (Today / Yesterday / N days ago) and
 * escalates to months / years only after a full month / year has elapsed —
 * see `getRelativeDayTier`. It never shows hours.
 */
function useLastSession(): LastSessionView | null {
  const drinkingSessionData = useCurrentUserDrinkingSessions();
  const preferences = useCurrentUserPreferences();
  const {translate} = useLocalize();
  const drinksToUnits = preferences?.drinks_to_units;

  return useMemo(() => {
    const lastSession = DSUtils.getLastSession(drinkingSessionData);
    if (!lastSession) {
      return null;
    }
    const {sessionId, session} = lastSession;

    const date = new Date(session.start_time);
    const tier = getRelativeDayTier(date, new Date());

    let when: string;
    switch (tier.unit) {
      case 'years':
        when = translate('homeScreen.banners.lastSession.yearsAgo', {
          count: tier.count,
        });
        break;
      case 'months':
        when = translate('homeScreen.banners.lastSession.monthsAgo', {
          count: tier.count,
        });
        break;
      case 'days':
        when = translate('homeScreen.banners.lastSession.daysAgo', {
          count: tier.count,
        });
        break;
      case 'yesterday':
        when = translate('homeScreen.banners.lastSession.yesterday');
        break;
      case 'today':
      default:
        when = translate('homeScreen.banners.lastSession.today');
    }

    return {
      sessionId,
      when,
      units: formatUnits(
        DSUtils.calculateTotalUnits(session.drinks, drinksToUnits),
      ),
      dateString: timestampToDateString(session.start_time),
    };
  }, [drinkingSessionData, drinksToUnits, translate]);
}

export default useLastSession;
export type {LastSessionView};
