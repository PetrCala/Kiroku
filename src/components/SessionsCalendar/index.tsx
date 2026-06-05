import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {useIsFocused} from '@react-navigation/native';
import type {DateData} from 'react-native-calendars';
import {
  differenceInMonths,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import {
  dateStringToDate,
  getPreviousMonth,
  getNextMonth,
} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {computeLoadTarget} from '@libs/SessionsCalendarUtils';
import CONST from '@src/CONST';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {DateString, Timestamp} from '@src/types/onyx/OnyxCommon';
import {useFirebase} from '@context/global/FirebaseContext';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import useStartEditSessionForDate from '@hooks/useStartEditSessionForDate';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import SessionsCalendarView from './SessionsCalendarView';
import SessionsCalendarWeekListView from './SessionsCalendarWeekListView';
import DayOverviewListView from './DayOverviewListView';
import type SessionsCalendarProps from './types';

// How many months of pre-loaded buffer to keep ahead of the user's scroll in
// fullscreen mode. When the earliest in-range visible day is within this
// many months of the loaded floor, ask `useLazyMarkedDates` to widen.
// Generous so that scrolls rarely catch up to in-flight fetches.
const LOAD_AHEAD_BUFFER_MONTHS = 6;

// On modal open, immediately request this many months of data so the user
// can scroll back a full year before triggering a live fetch. `loadUpTo`
// is idempotent — a no-op if the persisted depth is already deeper.
const INITIAL_PREFETCH_MONTHS = 12;

function SessionsCalendar({
  userID,
  visibleDate,
  onDateChange,
  drinkingSessionData,
  preferences,
  isFetchingOlderMonths,
  onDayDrillDown,
  isReadOnly,
  isEditModeOn,
  mode = 'compact',
  initialMonthYear,
  initialDay,
  onVisibleDayChange,
  onInitialScrollReady,
}: SessionsCalendarProps) {
  const {auth} = useFirebase();
  const [ongoingSession] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  // `useIsFocused` is false whenever this calendar's screen sits behind the live
  // session screen (it is presented over the central pane via the RHP, which
  // blurs the screen underneath — the same signal `FreezeWrapper` relies on).
  const isFocused = useIsFocused();
  // Overlay the live session's drinks onto the calendar, but only:
  //  - on the signed-in user's OWN calendar (this same component renders
  //    friends' data, which must never receive our local live buffer), and
  //  - while this calendar is actually on screen. The live buffer mutates on
  //    every drink tap; recomputing the (heavy, react-native-calendars) grid for
  //    an occluded calendar on each tap stalled the live screen's own paint. Drop
  //    the overlay while blurred so taps stay snappy; it recomputes once when the
  //    user returns and the screen refocuses.
  const isSelf = auth?.currentUser?.uid === userID;
  const ongoingOverlay =
    isSelf && isFocused && ongoingSession?.ongoing && ongoingSession.id
      ? ongoingSession
      : undefined;
  const {
    markedDates,
    unitsMap,
    monthlyTotalsMap,
    sessionEntriesByDay,
    loadedFrom,
    loadedFromDate,
    loadMoreMonths,
    loadUpTo,
    isLoading,
  } = useLazyMarkedDates(
    userID,
    drinkingSessionData ?? {},
    preferences,
    ongoingOverlay,
  );
  const startEditSessionForDate = useStartEditSessionForDate();
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  // Persisted floor for the viewed user — the canonical "started tracking on"
  // boundary. Falls back to the in-memory derivation when undefined, which
  // covers the brief window before the one-time backfill writes the field.
  const persistedEarliest: Timestamp | undefined =
    userDataList?.[userID]?.earliest_session_at;

  const minDate = useMemo(() => {
    const trackingStart =
      persistedEarliest !== undefined
        ? new Date(persistedEarliest)
        : DSUtils.getUserTrackingStartDate(drinkingSessionData);
    if (!trackingStart) {
      return CONST.DATE.MIN_DATE;
    }
    return format(trackingStart, CONST.DATE.CALENDAR_FORMAT);
  }, [drinkingSessionData, persistedEarliest]);

  const handleLeftArrowPress = (subtractMonth: () => void) => {
    const monthsAway = differenceInMonths(
      new Date(visibleDate.timestamp),
      new Date(loadedFrom?.current ?? new Date()),
    );
    if (monthsAway <= 1) {
      loadMoreMonths(1);
    }

    const previousMonth = getPreviousMonth(visibleDate);
    onDateChange(previousMonth);

    subtractMonth();
  };

  const handleRightArrowPress = (addMonth: () => void) => {
    const nextMonth = getNextMonth(visibleDate);
    onDateChange(nextMonth);
    addMonth();
  };

  // Coalesce scroll-driven `loadUpTo` calls — store the deepest target we've
  // already requested, skip subsequent triggers that aren't deeper. Avoids
  // spamming the friend-data fetcher on a fast scroll.
  const deepestRequestedRef = useRef<Date | null>(null);

  // Hard floor: the user's earliest tracked month. Widening past it only loads
  // empty months — and for the day-list (which renders no empty months) that
  // means the list never grows, so an unguarded `loadUpTo` would loop until
  // React's update-depth limit. Clamp to this and short-circuit once reached.
  const minDateFloor = useMemo(
    () => startOfMonth(parseISO(minDate)),
    [minDate],
  );

  // Whether there is older data still to load — drives the day-list's load
  // trigger and its "loading older" header. Once the loaded floor reaches the
  // earliest tracked month there is nothing more to fetch.
  const canLoadOlder =
    loadedFromDate !== null &&
    loadedFromDate.getTime() > minDateFloor.getTime();

  // Regular function — `loadedFrom` is a ref whose `.current` mutates
  // without re-rendering. A `useCallback` keyed on it would either be stale
  // or churn on every render. The view only calls this on real scroll
  // events, so referential stability isn't required.
  const handleRequestOlder = (earliestVisible: Date) => {
    const floor = loadedFrom?.current ?? new Date();
    if (floor.getTime() <= minDateFloor.getTime()) {
      // Already loaded back to the earliest tracked month — nothing more.
      return;
    }
    let target = computeLoadTarget(
      earliestVisible,
      floor,
      deepestRequestedRef.current,
      LOAD_AHEAD_BUFFER_MONTHS,
    );
    if (!target) {
      return;
    }
    if (target.getTime() < minDateFloor.getTime()) {
      target = minDateFloor;
    }
    deepestRequestedRef.current = target;
    loadUpTo(target);
  };

  // Eager prefetch on fullscreen open. The ref-guard makes this fire at
  // most once per fullscreen activation; `loadUpTo` is monotonic so even
  // without the guard the inner setState would short-circuit, but the
  // guard saves the per-render call entirely.
  const hasPrefetchedRef = useRef(false);
  useEffect(() => {
    if (mode === 'compact') {
      hasPrefetchedRef.current = false;
      return;
    }
    if (hasPrefetchedRef.current) {
      return;
    }
    hasPrefetchedRef.current = true;
    // If the user opened an enlarged view (fullscreen calendar or day-overview
    // scroll) on a month older than our default 12-month buffer, deepen the
    // prefetch to cover it. `loadUpTo` takes the deeper of any requested floor
    // — calling it twice is fine.
    const defaultFloor = subMonths(new Date(), INITIAL_PREFETCH_MONTHS);
    loadUpTo(defaultFloor);
    const targetMonthYear =
      initialMonthYear ?? (initialDay ? initialDay.slice(0, 7) : undefined);
    if (targetMonthYear) {
      const targetFloor = startOfMonth(parseISO(`${targetMonthYear}-01`));
      if (targetFloor < defaultFloor) {
        loadUpTo(targetFloor);
      }
    }
  }, [mode, loadUpTo, initialMonthYear, initialDay]);

  const onDayPress = useCallback(
    (dateData: DateData) => {
      const date = dateData.dateString as DateString;
      // The infinite (fullscreen) calendar opens a drill-down sheet on the host
      // screen; the compact calendar navigates to the day-overview scroll. The
      // scroll route carries `userID`, so it works for self and friends alike.
      if (mode === 'fullscreen') {
        onDayDrillDown?.(date);
        return;
      }
      Navigation.navigate(ROUTES.DAY_OVERVIEW.getRoute(userID, date));
    },
    [mode, userID, onDayDrillDown],
  );

  // Long-press a day → create a new edit session dated to that day and jump
  // straight to the edit screen. Gated to self at the call site below, so the
  // heavy-impact haptic (fired by GenericPressable when an onLongPress is
  // present) never triggers on a friend's calendar.
  const onDayLongPress = useCallback(
    (dateData: DateData) => {
      startEditSessionForDate(
        dateStringToDate(dateData.dateString as DateString),
      );
    },
    [startEditSessionForDate],
  );
  const dayLongPressHandler = isSelf ? onDayLongPress : undefined;

  if (isLoading) {
    return <FlexibleLoadingIndicator />;
  }

  if (mode === 'dayList') {
    return (
      <DayOverviewListView
        sessionEntriesByDay={sessionEntriesByDay}
        unitsMap={unitsMap}
        preferences={preferences}
        canLoadOlder={canLoadOlder}
        isFetchingOlderMonths={isFetchingOlderMonths}
        onRequestOlder={handleRequestOlder}
        initialDay={initialDay}
        onInitialScrollReady={onInitialScrollReady}
        onVisibleDayChange={onVisibleDayChange}
        isReadOnly={isReadOnly}
        isEditModeOn={isEditModeOn}
        onSwipeBack={Navigation.goBack}
      />
    );
  }

  if (mode === 'fullscreen') {
    return (
      <SessionsCalendarWeekListView
        markedDates={markedDates}
        unitsMap={unitsMap}
        monthlyTotalsMap={monthlyTotalsMap}
        loadedFromDate={loadedFromDate}
        isFetchingOlderMonths={isFetchingOlderMonths}
        onDayPress={onDayPress}
        onDayLongPress={dayLongPressHandler}
        onRequestOlder={handleRequestOlder}
        initialMonthYear={initialMonthYear}
        onInitialScrollReady={onInitialScrollReady}
        onSwipeBack={Navigation.goBack}
      />
    );
  }

  return (
    <SessionsCalendarView
      userID={userID}
      markedDates={markedDates}
      unitsMap={unitsMap}
      visibleDate={visibleDate}
      minDate={minDate}
      onDayPress={onDayPress}
      onDayLongPress={dayLongPressHandler}
      onLeftArrowPress={handleLeftArrowPress}
      onRightArrowPress={handleRightArrowPress}
      isFetchingOlderMonths={isFetchingOlderMonths}
    />
  );
}

SessionsCalendar.displayName = 'SessionsCalendar';
export default memo(SessionsCalendar);
