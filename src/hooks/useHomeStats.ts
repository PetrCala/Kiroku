import {useMemo} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {useOnyx} from 'react-native-onyx';
import type {DateData} from 'react-native-calendars';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useDrinkEvents from '@hooks/useStatistics/useDrinkEvents';
import {calculateThisMonthUnits} from '@libs/DataHandling';
import {buildMonthlyStats, DEFAULT_THRESHOLDS} from '@libs/Statistics/overview';
import type {MonthlyStats} from '@libs/Statistics/overview';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Home-screen stats for the current user, derived from the Statistics v2 event
 * stream for the calendar month `visibleDate`, plus its previous-month twin for
 * deltas and the in-progress live session's units. Thresholds come from the
 * user's `units_to_colors` preference. See `useUserMonthlyStats` for the
 * friend/profile equivalent.
 */
function useHomeStats(visibleDate: DateData): MonthlyStats {
  const {events, isLoading} = useDrinkEvents();
  const preferences = useCurrentUserPreferences();
  const [ongoingSessionData] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const isFocused = useIsFocused();

  const thresholds = useMemo(
    () => preferences?.units_to_colors ?? DEFAULT_THRESHOLDS,
    [preferences?.units_to_colors],
  );

  // Snapshot `now` once per mount so the current/previous clamps agree.
  const now = useMemo(() => new Date(), []);

  const {year, month} = visibleDate;
  const {current, previous, subPeriods} = useMemo(
    () => buildMonthlyStats(events, year, month, now, thresholds),
    [events, year, month, now, thresholds],
  );

  // Overlay the live session's units (visible month only). Gated on focus
  // because the buffer mutates on every drink tap while Home stays mounted
  // behind the live-session screen.
  //
  // `buildDrinkEvents` now includes `ongoing` sessions, so once the live
  // session has been echoed into the cached snapshot it is already counted in
  // `current.totalUnits`. Overlaying its buffer on top would then double-count
  // it, so skip the overlay when that session id is already in `events` (the
  // not-yet-cached case keeps the overlay, which is the fresher source).
  const drinksToUnits = preferences?.drinks_to_units;
  const liveSessionId = ongoingSessionData?.id;
  const liveAlreadyInEvents = useMemo(
    () =>
      !!liveSessionId &&
      events.some(event => event.sessionId === liveSessionId),
    [events, liveSessionId],
  );
  const liveExtraUnits = useMemo(() => {
    if (
      liveAlreadyInEvents ||
      !isFocused ||
      !drinksToUnits ||
      !ongoingSessionData?.ongoing
    ) {
      return 0;
    }
    return calculateThisMonthUnits(
      visibleDate,
      [ongoingSessionData],
      drinksToUnits,
    );
  }, [
    liveAlreadyInEvents,
    isFocused,
    ongoingSessionData,
    visibleDate,
    drinksToUnits,
  ]);

  return {isLoading, current, previous, subPeriods, liveExtraUnits};
}

export default useHomeStats;
