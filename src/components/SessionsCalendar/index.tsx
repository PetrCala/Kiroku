import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import type {DateData} from 'react-native-calendars';
import {differenceInMonths, format, subMonths} from 'date-fns';
import {getPreviousMonth, getNextMonth} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {computeLoadTarget} from '@libs/SessionsCalendarUtils';
import CONST from '@src/CONST';
import {useFirebase} from '@context/global/FirebaseContext';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {DateString, Timestamp} from '@src/types/onyx/OnyxCommon';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import SessionsCalendarView from './SessionsCalendarView';
import SessionsCalendarWeekListView from './SessionsCalendarWeekListView';
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
  mode = 'compact',
}: SessionsCalendarProps) {
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const {
    markedDates,
    unitsMap,
    loadedFrom,
    loadedFromDate,
    loadMoreMonths,
    loadUpTo,
    isLoading,
  } = useLazyMarkedDates(userID, drinkingSessionData ?? {}, preferences);
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  // Persisted floor for the viewed user — the canonical "started tracking on"
  // boundary. Falls back to the in-memory derivation when undefined, which
  // covers the brief window before the one-time backfill writes the field.
  const persistedEarliest: Timestamp | undefined =
    userDataList?.[userID]?.earliest_session_at;

  // Canonical "first ever session" Date for the viewed user — drives both
  // the compact view's `minDate` string and the fullscreen view's bottom
  // render cap. `null` when the user has no sessions and no persisted
  // floor (e.g. brand-new account before the one-time backfill runs).
  //
  // Note: the persisted timestamp can come back as `null` from Onyx in
  // some edge cases (deleted field, migration), so use a truthy check
  // rather than `!== undefined`. `new Date(null)` would otherwise be
  // epoch zero and silently disable the fullscreen cap.
  const trackingStartDate: Date | null = useMemo(() => {
    if (persistedEarliest) {
      return new Date(persistedEarliest);
    }
    return DSUtils.getUserTrackingStartDate(drinkingSessionData) ?? null;
  }, [drinkingSessionData, persistedEarliest]);

  const minDate = useMemo(() => {
    if (!trackingStartDate) {
      return CONST.DATE.MIN_DATE;
    }
    return format(trackingStartDate, CONST.DATE.CALENDAR_FORMAT);
  }, [trackingStartDate]);

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

  // Regular function — `loadedFrom` is a ref whose `.current` mutates
  // without re-rendering. A `useCallback` keyed on it would either be stale
  // or churn on every render. The view only calls this on real scroll
  // events, so referential stability isn't required.
  const handleRequestOlder = (earliestVisible: Date) => {
    const floor = loadedFrom?.current ?? new Date();
    const target = computeLoadTarget(
      earliestVisible,
      floor,
      deepestRequestedRef.current,
      LOAD_AHEAD_BUFFER_MONTHS,
    );
    if (target) {
      deepestRequestedRef.current = target;
      loadUpTo(target);
    }
  };

  // Eager prefetch on fullscreen open. The ref-guard makes this fire at
  // most once per fullscreen activation; `loadUpTo` is monotonic so even
  // without the guard the inner setState would short-circuit, but the
  // guard saves the per-render call entirely.
  const hasPrefetchedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'fullscreen') {
      hasPrefetchedRef.current = false;
      return;
    }
    if (hasPrefetchedRef.current) {
      return;
    }
    hasPrefetchedRef.current = true;
    loadUpTo(subMonths(new Date(), INITIAL_PREFETCH_MONTHS));
  }, [mode, loadUpTo]);

  const onDayPress = useCallback(
    (dateData: DateData) => {
      if (userID !== user?.uid) {
        return;
      }
      Navigation.navigate(
        ROUTES.DAY_OVERVIEW.getRoute(dateData.dateString as DateString),
      );
      // TODO display other user's sessions too in a clever manner
    },
    [userID, user?.uid],
  );

  if (isLoading) {
    return <FlexibleLoadingIndicator />;
  }

  if (mode === 'fullscreen') {
    return (
      <SessionsCalendarWeekListView
        markedDates={markedDates}
        unitsMap={unitsMap}
        loadedFromDate={loadedFromDate}
        firstSessionDate={trackingStartDate}
        isFetchingOlderMonths={isFetchingOlderMonths}
        onDayPress={onDayPress}
        onRequestOlder={handleRequestOlder}
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
      onLeftArrowPress={handleLeftArrowPress}
      onRightArrowPress={handleRightArrowPress}
      isFetchingOlderMonths={isFetchingOlderMonths}
    />
  );
}

SessionsCalendar.displayName = 'SessionsCalendar';
export default memo(SessionsCalendar);
