import {useEffect, useMemo, useRef, useState} from 'react';
import {toZonedTime} from 'date-fns-tz';
import type {
  DrinkingSessionArray,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';
import CONST from '@src/CONST';
import {
  differenceInCalendarMonths,
  eachDayOfInterval,
  format,
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
import type {UserID, DateString} from '@src/types/onyx/OnyxCommon';

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

  // First pass — rebuild the session-by-day index only when sessions or the
  // visible range change. Preferences are *not* a dependency here: a palette
  // or threshold change must not trigger the O(N) session filter+index pass.
  const {sessionIndex, dayKeys, loadedFromDate} = useMemo(() => {
    const today = new Date();
    const start = subDays(startOfMonth(subMonths(today, loadedMonths)), 1);
    const end = today;

    const index = new Map<DateString, DrinkingSessionArray>();
    Object.values(sessions)
      .filter(session => isWithinInterval(session.start_time, {start, end}))
      .forEach(session => {
        const sessionDate = toZonedTime(
          session.start_time,
          session.timezone ?? defaultTimezone,
        );
        const dayKey = format(
          sessionDate,
          CONST.DATE.FNS_FORMAT_STRING,
        ) as DateString;
        const existing = index.get(dayKey);
        if (existing) {
          existing.push(session);
        } else {
          index.set(dayKey, [session]);
        }
      });

    const days = eachDayOfInterval({start, end}).map(
      day => format(day, CONST.DATE.FNS_FORMAT_STRING) as DateString,
    );

    return {sessionIndex: index, dayKeys: days, loadedFromDate: start};
  }, [sessions, loadedMonths, defaultTimezone]);

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
    loadedFrom,
    loadedFromDate,
    loadMoreMonths,
    loadUpTo,
    isLoading: false,
  };
}

export default useLazyMarkedDates;
