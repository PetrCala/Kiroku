import {useEffect, useMemo, useRef, useState} from 'react';
import {toZonedTime} from 'date-fns-tz';
import type {
  DrinkingSessionArray,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';
import CONST from '@src/CONST';
import {
  differenceInCalendarMonths,
  eachDayOfInterval,
  isWithinInterval,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import {sessionsToDayMarking} from '@libs/DataHandling';
import useResolvedPalette from '@hooks/useResolvedPalette';
import lodashDebounce from 'lodash/debounce';
import type {MarkingProps} from 'react-native-calendars/src/calendar/day/marking';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import * as Calendar from '@userActions/Calendar';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import type {UserID, DateString} from '@src/types/onyx/OnyxCommon';

// Hand-rolled 'yyyy-MM-dd' (matches CONST.DATE.FNS_FORMAT_STRING). date-fns
// `format` is ~100× slower and this runs once per day across the whole loaded
// range — which can be years deep — so it dominated the day-overview mount
// (e.g. 77 months ≈ 2.3k `format` calls ≈ ~460ms on Hermes). The Date's local
// fields already carry the right wall-clock day (`toZonedTime` shifted them to
// the session's zone for the per-session key; the day list is built in local
// time), so reading them directly is both correct and cheap.
function toDateKey(date: Date): DateString {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month < 10 ? '0' : ''}${month}-${
    day < 10 ? '0' : ''
  }${day}` as DateString;
}

/**
 * Custom hook to derive a calendar's markedDates and per-day unit counts from a
 * session list and the user's preferences.
 *
 * `markedDates` is computed synchronously via `useMemo` — when any input
 * changes (sessions, preferences, the loaded month range), the next render
 * already carries the new payload. The earlier state-based pipeline left the
 * home calendar stale after a palette change because the state update path
 * had several failure modes (focus gating, batched setState during overlay
 * navigation, react-native-calendars memoization races). Synchronous
 * derivation is the same pattern the palette-picker preview uses, which is
 * why that path was reliable.
 *
 * `loadMoreMonths(N)` extends the visible range by N months by bumping
 * `loadedMonths` state, which triggers the memo to recompute.
 *
 * @param userID  ID of the user whose sessions/preferences these are
 * @param sessions Session list to render
 * @param preferences Preferences driving thresholds and palette
 */
function useLazyMarkedDates(
  userID: UserID,
  sessions: DrinkingSessionList,
  preferences: Preferences,
) {
  const [monthsLoaded, monthsLoadedMeta] = useOnyx(
    `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${userID}`,
  );
  const defaultTimezone = CONST.DEFAULT_TIME_ZONE.selected;

  // Resume the user's saved scroll depth (or 0 if this is the first visit).
  // Same logic for auth user and friends — state is per-UID now.
  const [loadedMonths, setLoadedMonths] = useState<number>(monthsLoaded ?? 0);

  // Resync `loadedMonths` when the source UID changes or when Onyx finishes
  // hydrating with a different saved depth. Gated on `metadata.status` so we
  // don't reset to 0 during the brief window where Onyx hasn't hydrated yet.
  useEffect(() => {
    if (monthsLoadedMeta.status !== 'loaded') {
      return;
    }
    setLoadedMonths(monthsLoaded ?? 0);
  }, [userID, monthsLoaded, monthsLoadedMeta.status]);

  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);

  // Cap the effective scroll depth at the user's earliest tracked month. The
  // `SESSIONS_CALENDAR_MONTHS_BY_USER_ID` lever is shared with the Statistics
  // fetch-window widener (`StatsContextProvider`), which a comparison/All
  // range can push a full span *before* the first session — inflating the
  // persisted depth well past the user's data. There are no sessions (and no
  // tracking) before `earliest_session_at`, so building day-keys / week-rows
  // there is pure waste and would paint "sober day" dots on untracked days.
  // Prefer the canonical backfilled floor, falling back to the earliest loaded
  // session for friend profiles and pre-backfill accounts.
  const earliestTracked = useMemo<Date | null>(() => {
    const persistedEarliest = userDataList?.[userID]?.earliest_session_at;
    if (persistedEarliest !== undefined) {
      return new Date(persistedEarliest);
    }
    return DSUtils.getUserTrackingStartDate(sessions);
  }, [userDataList, userID, sessions]);

  const cappedMonths = useMemo(() => {
    if (!earliestTracked) {
      return loadedMonths;
    }
    const monthsToEarliest = Math.max(
      0,
      differenceInCalendarMonths(new Date(), earliestTracked),
    );
    return Math.min(loadedMonths, monthsToEarliest);
  }, [loadedMonths, earliestTracked]);

  // First pass — rebuild the session-by-day index only when sessions or the
  // visible range change. Preferences are *not* a dependency here: a palette
  // or threshold change must not trigger the O(N) session filter+index pass.
  const {sessionIndex, sessionEntriesByDay, dayKeys, loadedFromDate} =
    useMemo(() => {
      const today = new Date();
      const start = subDays(startOfMonth(subMonths(today, cappedMonths)), 1);
      const end = today;

      const index = new Map<DateString, DrinkingSessionArray>();
      // Parallel index that keeps the session IDs alongside each session, so
      // consumers that render session tiles (the day-overview scroll) don't
      // have to re-derive IDs. Built in the same pass — the marking/units
      // passes below keep using `index` unchanged.
      const entriesByDay = new Map<DateString, DrinkingSessionKeyValue[]>();
      Object.entries(sessions)
        .filter(([, session]) =>
          isWithinInterval(session.start_time, {start, end}),
        )
        .forEach(([sessionId, session]) => {
          const sessionDate = toZonedTime(
            session.start_time,
            session.timezone ?? defaultTimezone,
          );
          const dayKey = toDateKey(sessionDate);
          const existing = index.get(dayKey);
          if (existing) {
            existing.push(session);
          } else {
            index.set(dayKey, [session]);
          }
          const existingEntries = entriesByDay.get(dayKey);
          if (existingEntries) {
            existingEntries.push({sessionId, session});
          } else {
            entriesByDay.set(dayKey, [{sessionId, session}]);
          }
        });

      const days = eachDayOfInterval({start, end}).map(toDateKey);

      return {
        sessionIndex: index,
        sessionEntriesByDay: entriesByDay,
        dayKeys: days,
        loadedFromDate: start,
      };
    }, [sessions, cappedMonths, defaultTimezone]);

  // Resolve which palette to render with. When the viewer has enabled
  // `use_own_palette_for_others`, this swaps the viewed user's palette for the
  // viewer's own; otherwise it returns the viewed user's palette.
  const palette = useResolvedPalette(preferences);

  // Substitute the resolved palette into the preferences object so downstream
  // pure functions (sessionsToDayMarking → convertUnitsToColors) use it without
  // needing to know about the toggle. Unit thresholds and drink mappings stay
  // the viewed user's — only the palette is swapped.
  const effectivePreferences = useMemo(
    () => ({...preferences, session_color_palette: palette}),
    [preferences, palette],
  );

  // Second pass — build markedDates + unitsMap + monthlyTotalsMap from the
  // pre-built index. This is the only memo that needs `preferences`; on a
  // palette change it walks the day list (~30 entries) instead of
  // re-filtering N sessions. `monthlyTotalsMap` is keyed by 'YYYY-MM'.
  const paletteGreen = palette.green;
  const {markedDatesMap, unitsMap, monthlyTotalsMap} = useMemo(() => {
    const newMarkedDatesMap = new Map<DateString, MarkingProps>();
    const newUnitsMap = new Map<DateString, number>();
    const newMonthlyTotalsMap = new Map<string, number>();

    dayKeys.forEach(dayKey => {
      const dailySessions = sessionIndex.get(dayKey) ?? [];
      const newMarking = sessionsToDayMarking(
        dailySessions,
        effectivePreferences,
      );
      if (!newMarking) {
        newMarkedDatesMap.set(dayKey, {color: paletteGreen});
        return;
      }
      newMarkedDatesMap.set(dayKey, newMarking.marking);
      newUnitsMap.set(dayKey, newMarking.units);
      // dayKey is 'YYYY-MM-DD' — slice the month bucket directly without
      // re-parsing the date.
      const monthKey = dayKey.slice(0, 7);
      newMonthlyTotalsMap.set(
        monthKey,
        (newMonthlyTotalsMap.get(monthKey) ?? 0) + newMarking.units,
      );
    });

    return {
      markedDatesMap: newMarkedDatesMap,
      unitsMap: newUnitsMap,
      monthlyTotalsMap: newMonthlyTotalsMap,
    };
  }, [sessionIndex, dayKeys, effectivePreferences, paletteGreen]);

  const markedDates: MarkedDates = useMemo(
    () => Object.fromEntries(markedDatesMap),
    [markedDatesMap],
  );

  // Mirror `loadedFromDate` into a ref for the orchestrator's arrow handler,
  // which needs a stable reference (preserves the existing public interface).
  // Only read in event handlers, so an effect-driven update is safe.
  const loadedFrom = useRef<Date | null>(null);
  useEffect(() => {
    loadedFrom.current = loadedFromDate;
  }, [loadedFromDate]);

  // Debounce the Onyx write so a rapid left-arrow scroll fires only one
  // listener-resubscribe / one friend-fetcher refetch at the end of the run.
  // The local visible window still updates synchronously below via setState,
  // so the calendar itself stays responsive.
  const persistMonthsLoaded = useMemo(
    () =>
      lodashDebounce((uid: UserID, next: number) => {
        Calendar.setSessionsCalendarMonthsLoadedForUser(uid, next);
      }, CONST.SESSIONS_CALENDAR_PERSIST_DEBOUNCE_MS),
    [],
  );

  // Cancel any pending debounced write on unmount so we don't leak a stale
  // timer (or write a depth that belongs to a previously-viewed user).
  useEffect(() => () => persistMonthsLoaded.cancel(), [persistMonthsLoaded]);

  const loadMoreMonths = (newMonthsToLoad = 1) => {
    setLoadedMonths(prev => {
      const next = prev + newMonthsToLoad;
      persistMonthsLoaded(userID, next);
      return next;
    });
  };

  // Widen the loaded window to (at least) include `target`. Used by the
  // scroll-driven fullscreen calendar where the user can flick across many
  // months in one gesture — a single `loadUpTo(target)` is cheaper than
  // calling `loadMoreMonths(1)` in a loop and keeps the Onyx-persist debounce
  // working as intended.
  const loadUpTo = (target: Date) => {
    const monthsNeeded = Math.max(
      0,
      differenceInCalendarMonths(new Date(), target),
    );
    setLoadedMonths(prev => {
      if (monthsNeeded <= prev) {
        return prev;
      }
      persistMonthsLoaded(userID, monthsNeeded);
      return monthsNeeded;
    });
  };

  return {
    markedDates,
    unitsMap,
    monthlyTotalsMap,
    sessionEntriesByDay,
    loadedFrom,
    loadedFromDate,
    loadMoreMonths,
    loadUpTo,
    isLoading: false,
  };
}

export default useLazyMarkedDates;
