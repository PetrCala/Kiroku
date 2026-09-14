import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useIsFocused} from '@react-navigation/native';
import type {DateData} from 'react-native-calendars';
import {format, parseISO, startOfMonth, subMonths} from 'date-fns';
import {
  dateStringToDate,
  dateToDateData,
  getPreviousMonth,
  getNextMonth,
} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as DS from '@userActions/DrinkingSession';
import * as App from '@userActions/App';
import {
  computeLoadTarget,
  getCompactCalendarLoadTarget,
} from '@libs/SessionsCalendarUtils';
import CONST from '@src/CONST';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {DateString, Timestamp} from '@src/types/onyx/OnyxCommon';
import type {DrinkingSessionList} from '@src/types/onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import useStartEditSessionForDate from '@hooks/useStartEditSessionForDate';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import SessionsCalendarView from './SessionsCalendarView';
import SessionsCalendarWeekListView from './SessionsCalendarWeekListView';
import DayOverviewListView from './DayOverviewListView';
import DayDrillDownSheet from './DayDrillDownSheet';
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

// Once the fullscreen list has scrolled past the earliest-tracked floor there
// is no more data to fetch (those months are empty), but the user may still
// want to scroll into them to add a past session. Extend the *rendered* range
// by this many months at a time as they approach the top — no fetch involved.
const RENDER_AHEAD_MONTHS = 12;

// Compact-calendar page-back look-ahead. Paging left always widens the loaded
// window (via `loadUpTo`) to at least the month about to be shown plus this
// many months below it, so the windowed friend fetch is pre-warmed and the new
// month never renders blank until the user moves again (Rule 1). `loadUpTo` is
// monotonic and capped at the user's earliest tracked month for self, so the
// buffer never derives empty pre-tracking months.
const COMPACT_LOAD_AHEAD_BUFFER_MONTHS = 3;

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
    sessionEntriesByDay,
    calendarMonths,
    loadedFrom,
    loadedFromDate,
    loadUpTo,
    hasPersistedFloor,
    isWindowExhausted,
    isLoading,
  } = useLazyMarkedDates(
    userID,
    drinkingSessionData ?? {},
    preferences,
    ongoingOverlay,
    {
      // Fullscreen + canonical floor (self): derive the whole tracked range up
      // front so scrolling back never waits on a widen — the data is all
      // on-device. Does not touch the persisted depth lever. No-op for friends.
      deriveFullRangeToFloor: mode === 'fullscreen',
    },
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
    const previousMonth = getPreviousMonth(visibleDate);
    // Proactively widen the loaded window so the month about to become visible
    // (plus a small look-ahead buffer that pre-warms the windowed friend fetch)
    // is always inside the derived/fetched range. Replaces the old reactive
    // `monthsAway <= 1 ? loadMoreMonths(1)` step, which locked the floor
    // one-to-one with the visible month and left a friend's just-paged month
    // blank until a debounced refetch landed (Rule 1: data is always rendered,
    // with no in-calendar navigation needed for it to appear). `loadUpTo` is
    // monotonic, so re-requesting the same depth on a later press is a no-op.
    loadUpTo(
      getCompactCalendarLoadTarget(
        new Date(previousMonth.timestamp),
        COMPACT_LOAD_AHEAD_BUFFER_MONTHS,
      ),
    );
    onDateChange(previousMonth);

    subtractMonth();
  };

  const handleRightArrowPress = (addMonth: () => void) => {
    const nextMonth = getNextMonth(visibleDate);
    onDateChange(nextMonth);
    addMonth();
  };

  // Snap the compact calendar back to the current month. Always moves toward
  // today (forward through already-loaded months), so no widening is needed.
  const handleJumpToCurrent = () => {
    onDateChange(dateToDateData(new Date()));
  };

  // Record the day the viewer is looking at in this user's enlarged calendar /
  // day-overview scroll, into that user's OWN per-user last-viewed slot. Bound
  // to the viewed `userID`, so a friend's scroll restores the friend's profile
  // (and the signed-in user's restores home/self) without ever repointing
  // another user's calendar (Rule 2: per-user independence is structural).
  const recordLastViewedDay = useCallback(
    (day: DateString) => App.setLastViewedCalendarDate(userID, day),
    [userID],
  );

  // Coalesce scroll-driven `loadUpTo` calls — store the deepest target we've
  // already requested, skip subsequent triggers that aren't deeper. Avoids
  // spamming the friend-data fetcher on a fast scroll.
  const deepestRequestedRef = useRef<Date | null>(null);

  // Hard floor: the user's earliest tracked month. Widening past it only loads
  // empty months — and for the day-list (which renders no empty months) that
  // means the list never grows, so an unguarded `loadUpTo` would loop until
  // React's update-depth limit. Clamp to this and short-circuit once reached.
  //
  // Only authoritative when `hasPersistedFloor` (self): then `minDate` is the
  // canonical `earliest_session_at`. For a friend `minDate` is derived from the
  // windowed session slice, so it collapses onto the current loaded edge — using
  // it as a hard floor froze scroll-back at the 12-month prefetch window
  // (Kiroku #1197). The friend path uses `isWindowExhausted` instead (below).
  const minDateFloor = useMemo(
    () => startOfMonth(parseISO(minDate)),
    [minDate],
  );

  // Absolute floor for navigation/rendering — the product's 20-year horizon.
  // Bounds how far the compact calendar can page and the fullscreen list can
  // scroll into empty pre-tracking months, so neither can run away to year 1.
  const absoluteFloor = useMemo(
    () => startOfMonth(CONST.CALENDAR_PICKER.MIN_DATE),
    [],
  );

  // Fullscreen-only render floor, decoupled from the data floor. The data
  // floor (`loadedFromDate`, capped at the earliest tracked month) governs
  // what's *fetched*; this governs what's *rendered*. It extends past the data
  // floor as the user scrolls toward the top, letting them reach pre-tracking
  // days (which render blank/dimmed — no fetch) down to `absoluteFloor`.
  const [renderFromDate, setRenderFromDate] = useState<Date | null>(null);

  // When the fullscreen view opens centered on a month *before* the user's
  // tracking start (e.g. from a compact calendar paged into pre-tracking
  // months), the target can never enter the data range — the derivation is
  // capped at the canonical floor. Extend the render floor to cover it so the
  // centering target exists from the first render; without this the initial
  // scroll never resolves and the screen would hang on its skeleton. Self-only
  // (`hasPersistedFloor`): for a friend the floor is unknown, so the target is
  // reached by widening the fetch window instead (the prefetch effect below).
  const initialRenderTarget = useMemo(() => {
    if (mode !== 'fullscreen' || !initialMonthYear || !hasPersistedFloor) {
      return null;
    }
    const target = startOfMonth(parseISO(`${initialMonthYear}-01`));
    if (target >= minDateFloor) {
      return null;
    }
    return target < absoluteFloor ? absoluteFloor : target;
  }, [mode, initialMonthYear, hasPersistedFloor, minDateFloor, absoluteFloor]);

  const fullscreenRenderFrom = useMemo(() => {
    if (!loadedFromDate) {
      return loadedFromDate;
    }
    let candidate =
      renderFromDate && renderFromDate < loadedFromDate
        ? renderFromDate
        : loadedFromDate;
    if (initialRenderTarget && initialRenderTarget < candidate) {
      candidate = initialRenderTarget;
    }
    return candidate < absoluteFloor ? absoluteFloor : candidate;
  }, [loadedFromDate, renderFromDate, initialRenderTarget, absoluteFloor]);

  // Whether there is older data still to load — drives the day-list's load
  // trigger and its "loading older" header, and the week-list's pending
  // skeleton months.
  //  - Self (canonical floor): stop once the loaded window reaches the earliest
  //    tracked month (with the fullscreen full-range derivation this is true
  //    from the first render). Compared at month granularity for robustness —
  //    `loadedFromDate` is already a `startOfMonth`.
  //  - Friend (no canonical floor): keep loading until the window is exhausted —
  //    the server returns nothing earlier than what we already have.
  const canLoadOlder = hasPersistedFloor
    ? loadedFromDate !== null &&
      startOfMonth(loadedFromDate).getTime() > minDateFloor.getTime()
    : !isWindowExhausted;

  // Regular function — `loadedFrom` is a ref whose `.current` mutates
  // without re-rendering. A `useCallback` keyed on it would either be stale
  // or churn on every render. The view only calls this on real scroll
  // events, so referential stability isn't required.
  const handleRequestOlder = (earliestVisible: Date) => {
    const floor = loadedFrom?.current ?? new Date();
    // Self (canonical floor): stop once loaded back to the earliest tracked
    // month — with the fullscreen full-range derivation that's the case from
    // the very first call. In fullscreen, keep widening the *rendered* range
    // past it so the user can scroll into the empty pre-tracking months (to
    // add a past session); those render blank/dimmed for free. Walls at
    // `absoluteFloor`.
    if (hasPersistedFloor) {
      if (startOfMonth(floor).getTime() <= minDateFloor.getTime()) {
        if (mode === 'fullscreen') {
          setRenderFromDate(prev => {
            const current = prev ?? loadedFromDate ?? new Date();
            if (current.getTime() <= absoluteFloor.getTime()) {
              return prev;
            }
            let next = startOfMonth(
              subMonths(earliestVisible, RENDER_AHEAD_MONTHS),
            );
            if (next < absoluteFloor) {
              next = absoluteFloor;
            }
            // Monotonic — only ever grow older.
            return !prev || next < prev ? next : prev;
          });
        }
        return;
      }
    } else if (isWindowExhausted) {
      // Friend (no canonical floor): `minDateFloor` is only the windowed edge,
      // so never clamp to it; the history is done only once the window is
      // exhausted (empty/denied reads included) — Kiroku #1197.
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
    // Clamp to the canonical floor only when we actually know it (self). For a
    // friend the floor is the windowed edge, so clamping there would re-freeze
    // scroll-back at the current window; let the target ride down past it and
    // rely on `isWindowExhausted` to stop once the history runs out.
    if (hasPersistedFloor && target.getTime() < minDateFloor.getTime()) {
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
    // Fullscreen + canonical floor (self): the full tracked range is derived
    // up front (`deriveFullRangeToFloor`), so there is nothing to prefetch and
    // no reason to bump the persisted depth lever. The day-list keeps the
    // prefetch — it still loads lazily. If the floor hydrates late, one
    // friend-style prefetch may fire first; harmless and parity with before.
    if (mode === 'fullscreen' && hasPersistedFloor) {
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
  }, [mode, loadUpTo, initialMonthYear, initialDay, hasPersistedFloor]);

  // Compact calendar: keep the loaded window covering whatever month is
  // currently visible, plus the same look-ahead buffer the page-back handler
  // uses. The visible month can change three ways — left arrow, swipe, or a
  // last-viewed restore (`NVP_LAST_VIEWED_CALENDAR_DATE`, set when the user
  // scrolled the fullscreen calendar / day-overview, e.g. while logging a
  // back-dated session). Only the first two flow through `handleLeftArrowPress`'s
  // proactive `loadUpTo`; the restore path sets `visibleDate` directly. Without
  // this effect a restored month deeper than the loaded window derives zero
  // markedDates and renders blank — even though the "This month" summary card
  // above reads the FULL (unwindowed) session history and shows the right
  // numbers (the card-vs-grid window asymmetry). Keying on the visible month
  // closes that gap so the visible month always renders regardless of HOW it
  // was selected (Rule 1: data is always rendered — what PR #1297 left open for
  // the last-viewed-restore path).
  //
  // Compact-only: fullscreen derives its whole range up front
  // (`deriveFullRangeToFloor`). Referenced via the stable primitive
  // `visibleDate.timestamp` so the effect re-runs only on a real month change.
  // `loadUpTo` is monotonic and capped at the user's earliest tracked month for
  // self, so re-requesting once already deep enough is a safe no-op and it never
  // derives empty pre-tracking months.
  const visibleTimestamp = visibleDate.timestamp;
  useEffect(() => {
    if (mode !== 'compact') {
      return;
    }
    loadUpTo(
      getCompactCalendarLoadTarget(
        new Date(visibleTimestamp),
        COMPACT_LOAD_AHEAD_BUFFER_MONTHS,
      ),
    );
  }, [mode, visibleTimestamp, loadUpTo]);

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

  // The day whose long-press drill-down sheet is open, or null when closed.
  // Only used for days with more than one session (see `onDayLongPress`).
  const [longPressDrillDownDate, setLongPressDrillDownDate] =
    useState<DateString | null>(null);

  // Long-press a day → the fastest path to editing that day:
  //  - no session yet  → create a new edit session dated to that day,
  //  - exactly one     → jump straight into editing it,
  //  - more than one   → open a drill-down sheet listing the day's sessions so
  //                      the user can pick which one to edit (each tile carries
  //                      an edit affordance, like the day-overview screen).
  // Gated to self at the call site below, so the heavy-impact haptic (fired by
  // GenericPressable when an onLongPress is present) never triggers on a
  // friend's calendar.
  const onDayLongPress = useCallback(
    (dateData: DateData) => {
      const dateString = dateData.dateString as DateString;
      const date = dateStringToDate(dateString);
      const daySessions = DSUtils.getSingleDayDrinkingSessions(
        date,
        drinkingSessionData ?? undefined,
        false,
      ) as DrinkingSessionList;
      const entries = Object.entries(daySessions);

      if (entries.length === 0) {
        startEditSessionForDate(date);
        return;
      }
      if (entries.length === 1) {
        const [sessionId, session] = entries[0];
        DS.navigateToEditSessionScreen(sessionId, session).catch(() => {});
        return;
      }
      setLongPressDrillDownDate(dateString);
    },
    [drinkingSessionData, startEditSessionForDate],
  );
  const dayLongPressHandler = isSelf ? onDayLongPress : undefined;

  const handleDrillDownClose = useCallback(
    () => setLongPressDrillDownDate(null),
    [],
  );

  // The drill-down sheet shown when a day with multiple sessions is long-
  // pressed. Mounted only for self (long-press is gated to self) and kept
  // mounted across the edit round-trip so it reopens on back with live data.
  const longPressDrillDown = isSelf ? (
    <DayDrillDownSheet
      isVisible={!!longPressDrillDownDate}
      onClose={handleDrillDownClose}
      date={longPressDrillDownDate}
      drinkingSessionData={drinkingSessionData}
      preferences={preferences}
      canEdit
    />
  ) : null;

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
        onRecordLastViewedDay={recordLastViewedDay}
        isReadOnly={isReadOnly}
        isEditModeOn={isEditModeOn}
        onSwipeBack={Navigation.goBack}
      />
    );
  }

  if (mode === 'fullscreen') {
    return (
      <>
        <SessionsCalendarWeekListView
          calendarMonths={calendarMonths}
          renderFromDate={fullscreenRenderFrom}
          canLoadOlder={canLoadOlder}
          trackingStartDate={minDate}
          onDayPress={onDayPress}
          onDayLongPress={dayLongPressHandler}
          onRequestOlder={handleRequestOlder}
          initialMonthYear={initialMonthYear}
          onInitialScrollReady={onInitialScrollReady}
          onSwipeBack={Navigation.goBack}
          onRecordLastViewedDay={recordLastViewedDay}
        />
        {longPressDrillDown}
      </>
    );
  }

  return (
    <>
      <SessionsCalendarView
        userID={userID}
        markedDates={markedDates}
        unitsMap={unitsMap}
        visibleDate={visibleDate}
        minDate={format(absoluteFloor, CONST.DATE.CALENDAR_FORMAT)}
        trackingStartDate={minDate}
        onDayPress={onDayPress}
        onDayLongPress={dayLongPressHandler}
        onLeftArrowPress={handleLeftArrowPress}
        onRightArrowPress={handleRightArrowPress}
        onJumpToCurrent={handleJumpToCurrent}
        isFetchingOlderMonths={isFetchingOlderMonths}
      />
      {longPressDrillDown}
    </>
  );
}

SessionsCalendar.displayName = 'SessionsCalendar';
export default memo(SessionsCalendar);
