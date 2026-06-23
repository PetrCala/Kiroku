import {useMemo} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {useOnyx} from 'react-native-onyx';
import type {DateData} from 'react-native-calendars';
import useCurrentUserData from '@hooks/useCurrentUserData';
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
  const {year, month} = visibleDate;

  // The scorecard reads only the visible month and the previous month (the
  // current/previous summaries and the per-week sub-period series — see
  // `buildMonthlyStats`). Scope the event stream to exactly that window so the
  // launch-path walk stays ~2 months wide instead of materialising the whole
  // history. Bounds mirror `buildMonthlyStats` (`month` is 1-based): the
  // previous month's start through the end of the visible month.
  const eventWindow = useMemo(() => {
    const prevStart = new Date(year, month - 2, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    return {startMs: prevStart.getTime(), endMs: monthEnd.getTime()};
  }, [year, month]);

  // DIAGNOSTIC A/B lever (StatsPerf): `full` reverts #1414's compute windowing
  // (passes no window → whole-history walk) so the windowing's contribution can
  // be isolated on-device. Defaults to the current (`window`) behaviour.
  const [perfDebug] = useOnyx(ONYXKEYS.NVP_STATS_PERF_DEBUG, {
    canBeMissing: true,
  });
  const computeFullHistory = perfDebug?.computeScope === 'full';
  const {events, isLoading, earliestStartMs} = useDrinkEvents(
    undefined,
    computeFullHistory ? undefined : {window: eventWindow},
  );
  const preferences = useCurrentUserPreferences();
  const currentUserData = useCurrentUserData();
  const [ongoingSessionData] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const isFocused = useIsFocused();

  const thresholds = useMemo(
    () => preferences?.units_to_colors ?? DEFAULT_THRESHOLDS,
    [preferences?.units_to_colors],
  );

  // Snapshot `now` once per mount so the current/previous clamps agree.
  const now = useMemo(() => new Date(), []);

  // Prefer the persisted first-activity floor; fall back to the windowed hook's
  // cheap all-history minimum so `comparisonAvailable` stays correct even before
  // `earliest_session_at` has hydrated.
  const earliestSessionAt =
    currentUserData?.earliest_session_at ?? earliestStartMs;
  const {current, previous, subPeriods, isCurrentMonth, comparisonAvailable} =
    useMemo(
      () =>
        buildMonthlyStats(
          events,
          year,
          month,
          now,
          thresholds,
          earliestSessionAt,
        ),
      [events, year, month, now, thresholds, earliestSessionAt],
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

  return {
    isLoading,
    current,
    previous,
    subPeriods,
    liveExtraUnits,
    isCurrentMonth,
    comparisonAvailable,
  };
}

export default useHomeStats;
