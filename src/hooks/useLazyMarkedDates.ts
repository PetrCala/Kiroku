import {useEffect, useMemo, useRef, useState} from 'react';
import {toZonedTime} from 'date-fns-tz';
import type {
  DrinkingSession,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';
import CONST from '@src/CONST';
import {differenceInCalendarMonths, startOfMonth, subMonths} from 'date-fns';
import {sessionsToDayMarking} from '@libs/DataHandling';
import useResolvedPalette from '@hooks/useResolvedPalette';
import lodashDebounce from 'lodash/debounce';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import * as Calendar from '@userActions/Calendar';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {
  getDerivedCalendarMonth,
  groupSessionsByMonth,
  toDateKey,
  toMonthKey,
} from '@components/SessionsCalendar/deriveCalendarMonth';
import type {
  CalendarMonthData,
  DayCellData,
} from '@components/SessionsCalendar/deriveCalendarMonth';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';
import type {UserID, DateString} from '@src/types/onyx/OnyxCommon';

type UseLazyMarkedDatesOptions = {
  /** Derive the whole tracked range (down to the canonical
   *  `earliest_session_at` floor) immediately, instead of the lazily widened
   *  `loadedMonths` window. Used by the fullscreen calendar for the signed-in
   *  user, whose sessions are all on-device — scrolling back then never waits
   *  on a widen. Does NOT touch the persisted depth lever (`loadUpTo` still
   *  governs that), so the compact calendar's and Statistics' shared depth
   *  stay exactly as driven by their own usage. No-op for users without the
   *  canonical floor (friends). */
  deriveFullRangeToFloor?: boolean;
};

/**
 * Custom hook to derive a calendar's markedDates and per-day unit counts from a
 * session list and the user's preferences.
 *
 * Derivation is per-month and cached (see `deriveCalendarMonth`): widening the
 * loaded window only derives the newly exposed months, and previously derived
 * months keep referential identity — the fullscreen week-list's row memoization
 * depends on this. The merged outputs (`markedDates`, `unitsMap`,
 * `monthlyTotalsMap`, `sessionEntriesByDay`) are reassembled from the cached
 * months via cheap reference copies, preserving the original contracts for the
 * compact calendar (react-native-calendars) and the day-overview list.
 *
 * `loadMoreMonths(N)` extends the visible range by N months by bumping
 * `loadedMonths` state, which triggers the assembly memo to recompute.
 *
 * @param userID  ID of the user whose sessions/preferences these are
 * @param sessions Session list to render
 * @param preferences Preferences driving thresholds and palette
 * @param ongoingOverlay The current user's live (in-progress) session, when its
 *   live drinks should be reflected on top of `sessions`. The caller is
 *   responsible for gating this to the signed-in user (a friend's calendar must
 *   never receive it). Live drinks live only in `ONGOING_SESSION_DATA`, not the
 *   cached snapshot — see `DrinkingSession.flushLiveSessionPersist`. Overlaid as
 *   a cheap single-day patch so the heavy index passes stay off the per-tap path.
 * @param options See `UseLazyMarkedDatesOptions`.
 */
function useLazyMarkedDates(
  userID: UserID,
  sessions: DrinkingSessionList,
  preferences: Preferences,
  ongoingOverlay?: DrinkingSession,
  options?: UseLazyMarkedDatesOptions,
) {
  const [monthsLoaded, monthsLoadedMeta] = useOnyx(
    `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${userID}`,
  );
  const defaultTimezone = CONST.DEFAULT_TIME_ZONE.selected;
  const deriveFullRangeToFloor = options?.deriveFullRangeToFloor === true;

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

  // Whether the viewed user has a *canonical* earliest-tracked floor. It is
  // only ever written for the signed-in user (the `earliest_session_at` backfill
  // / session-write path keys it on the authoring uid); no friend read carries
  // it. So this is `true` for self and `false` for friends — the distinction the
  // capping below and the orchestrator's load-older guards both turn on.
  const persistedEarliest = userDataList?.[userID]?.earliest_session_at;
  const hasPersistedFloor = persistedEarliest !== undefined;

  // Cap the effective scroll depth at the user's earliest tracked month — but
  // ONLY when we know the canonical floor (self). The
  // `SESSIONS_CALENDAR_MONTHS_BY_USER_ID` lever is shared with the Statistics
  // fetch-window widener (`StatsContextProvider`), which a comparison/All
  // range can push a full span *before* the first session — inflating the
  // persisted depth well past the user's data. There are no sessions (and no
  // tracking) before `earliest_session_at`, so building day-keys / week-rows
  // there is pure waste and would paint "sober day" dots on untracked days.
  //
  // For a FRIEND there is no canonical floor: `sessions` is the server-windowed
  // slice, so its earliest entry is the edge of what we've fetched, NOT the
  // friend's real first session. Capping to it would clamp the build to the
  // current window and freeze scroll-back at the window edge (Kiroku #1197).
  // So when the floor is unknown we don't cap — `loadUpTo` only ever deepens as
  // far as the user actually scrolls, and the fetch hook stops returning earlier
  // sessions once the friend's history is exhausted, so the build can't run away
  // into empty pre-tracking months.
  const earliestTracked = useMemo<Date | null>(() => {
    if (hasPersistedFloor) {
      return new Date(persistedEarliest);
    }
    return null;
  }, [hasPersistedFloor, persistedEarliest]);

  // Months between today and the canonical floor — null when there is no
  // canonical floor (friends).
  const monthsToEarliest = useMemo<number | null>(() => {
    if (!earliestTracked) {
      return null;
    }
    return Math.max(0, differenceInCalendarMonths(new Date(), earliestTracked));
  }, [earliestTracked]);

  const cappedMonths =
    monthsToEarliest === null
      ? loadedMonths
      : Math.min(loadedMonths, monthsToEarliest);

  // Depth the derivation actually builds. `deriveFullRangeToFloor` (fullscreen
  // self) jumps straight to the canonical floor without touching the persisted
  // lever; everyone else uses the lazily widened window.
  const effectiveMonths =
    deriveFullRangeToFloor && monthsToEarliest !== null
      ? monthsToEarliest
      : cappedMonths;

  // First pass — regroup the sessions by zoned month/day only when the source
  // list changes. Widening the loaded window doesn't touch this O(N) pass.
  const sessionsByMonth = useMemo(
    () => groupSessionsByMonth(sessions, defaultTimezone),
    [sessions, defaultTimezone],
  );

  // Whether scrolling back can still reveal older data. Only meaningful when the
  // viewed user has NO canonical floor (a friend): `sessions` is the windowed
  // slice, so we can't derive the true first session from it. Instead we ask
  // "did the current window actually reach the bottom of the friend's history?"
  //
  //  - No sessions at all (empty / privacy-denied / evicted #786 read): there is
  //    nothing to widen into. Exhausted — so the orchestrator stops, no infinite
  //    widen loop and a clean empty calendar.
  //  - Earliest loaded session's month is STRICTLY LATER than the fetch floor
  //    month: the server returned every session with `start_time >= fetch floor`
  //    and the earliest one still sits above that floor, so there is provably
  //    nothing older. Exhausted — the earliest loaded session IS the real first.
  //  - Earliest loaded session sits IN the fetch floor month: the window may be
  //    clipping older sessions at the edge, so keep widening (not exhausted).
  //
  // The comparison is against the FETCH floor (`useDrinkingSessionsFetch` reads
  // `start_time >= startOfMonth(subMonths(now, max(SESSIONS_INITIAL_FETCH_MONTHS,
  // monthsLoaded)))`), NOT the render floor — the fetch window is what bounds
  // what the server could have returned.
  // For self this is unused — the persisted floor drives the guards directly.
  // Plain derivation: React Compiler memoizes it from the captured reads
  // (`hasPersistedFloor`, `sessions`, `loadedMonths`), so no manual `useMemo`.
  let isWindowExhausted = false;
  if (!hasPersistedFloor) {
    // Self: the canonical floor governs; this signal isn't consulted, so it
    // stays false above.
    const earliestLoaded = DSUtils.getUserTrackingStartDate(sessions);
    if (!earliestLoaded) {
      isWindowExhausted = true;
    } else {
      const fetchFloorMonths = Math.max(
        CONST.SESSIONS_INITIAL_FETCH_MONTHS,
        loadedMonths,
      );
      const fetchFloorMonth = startOfMonth(
        subMonths(new Date(), fetchFloorMonths),
      );
      isWindowExhausted =
        startOfMonth(earliestLoaded).getTime() > fetchFloorMonth.getTime();
    }
  }

  // Resolve which palette to render with. When the viewer has enabled
  // `use_own_palette_for_others`, this swaps the viewed user's palette for the
  // viewer's own; otherwise it returns the viewed user's palette.
  const palette = useResolvedPalette(preferences);

  // Substitute the resolved palette into the preferences object so downstream
  // pure functions (sessionsToDayMarking → convertUnitsToColors) use it without
  // needing to know about the toggle. Unit thresholds and drink mappings stay
  // the viewed user's — only the palette is swapped. Also the month-cache
  // branch key: a fresh object here invalidates every cached month, which is
  // exactly right for a palette/threshold change.
  const effectivePreferences = useMemo(
    () => ({...preferences, session_color_palette: palette}),
    [preferences, palette],
  );

  // Second pass — assemble the loaded range from cached per-month derivations.
  // On a widen only the newly exposed months actually derive; everything else
  // is reference-copied, so this memo is O(loaded days) of Map sets at worst.
  const paletteGreen = palette.green;
  const {
    calendarMonths,
    markedDates,
    unitsMap,
    monthlyTotalsMap,
    sessionEntriesByDay,
    loadedFromDate,
  } = useMemo(() => {
    const today = new Date();
    // Hoisted const, not inlined in the return literal: inside the object
    // literal TS 5.x loses the date-fns generic inference (the literal is the
    // useMemo type-inference source) and degrades the property to `any`.
    const rangeStart = startOfMonth(subMonths(today, effectiveMonths));
    const months: CalendarMonthData[] = [];
    const newMarkedDates: MarkedDates = {};
    const newUnitsMap = new Map<DateString, number>();
    const newMonthlyTotalsMap = new Map<string, number>();
    const newSessionEntriesByDay = new Map<
      DateString,
      DrinkingSessionKeyValue[]
    >();

    for (let monthsBack = effectiveMonths; monthsBack >= 0; monthsBack--) {
      const monthStart = startOfMonth(subMonths(today, monthsBack));
      const monthData = getDerivedCalendarMonth({
        year: monthStart.getFullYear(),
        month: monthStart.getMonth(),
        monthEntriesByDay: sessionsByMonth.get(
          toMonthKey(monthStart.getFullYear(), monthStart.getMonth()),
        ),
        effectivePreferences,
        endClamp: monthsBack === 0 ? today : null,
      });
      months.push(monthData);
      monthData.dayData.forEach((cell, dayKey) => {
        newMarkedDates[dayKey] = cell.marking;
        if (cell.units !== undefined) {
          newUnitsMap.set(dayKey, cell.units);
        }
      });
      monthData.entriesByDay.forEach((entries, dayKey) => {
        newSessionEntriesByDay.set(dayKey, entries);
      });
      if (monthData.entriesByDay.size > 0) {
        newMonthlyTotalsMap.set(monthData.monthKey, monthData.totalUnits);
      }
    }

    return {
      calendarMonths: months,
      markedDates: newMarkedDates,
      unitsMap: newUnitsMap,
      monthlyTotalsMap: newMonthlyTotalsMap,
      sessionEntriesByDay: newSessionEntriesByDay,
      loadedFromDate: rangeStart,
    };
  }, [sessionsByMonth, effectiveMonths, effectivePreferences]);

  // Overlay the live (in-progress) session on top of the base outputs. The live
  // buffer's drinks are deliberately kept out of `cachedDrinkingSessions` (the
  // server skips the cache echo while `sessionIsLive && ongoing`), so without
  // this the day tile / day-overview / month totals show the session flagged
  // ongoing but with 0 units until it is finalized. Patches only the overlay
  // session's single day — and, for the per-month sections, only that day's
  // month — so a drink tap costs one day's recompute plus shallow clones, not a
  // full re-index. Every other month keeps referential identity. When there is
  // no live session the base outputs are returned untouched (refs stable, zero
  // overhead).
  const {
    calendarMonths: overlaidCalendarMonths,
    markedDates: overlaidMarkedDates,
    unitsMap: overlaidUnitsMap,
    monthlyTotalsMap: overlaidMonthlyTotalsMap,
    sessionEntriesByDay: overlaidSessionEntriesByDay,
  } = useMemo(() => {
    if (!ongoingOverlay?.ongoing || !ongoingOverlay.id) {
      return {
        calendarMonths,
        markedDates,
        unitsMap,
        monthlyTotalsMap,
        sessionEntriesByDay,
      };
    }

    const overlayId = ongoingOverlay.id;
    const overlayDate = toZonedTime(
      ongoingOverlay.start_time,
      ongoingOverlay.timezone ?? defaultTimezone,
    );
    const dayKey = toDateKey(overlayDate);
    const monthKey = dayKey.slice(0, 7);

    // Replace the stale cached entry for this session (same id) with the live
    // one, keeping any other sessions on that day; append if the cache has not
    // seeded it yet.
    const baseEntries = sessionEntriesByDay.get(dayKey) ?? [];
    const liveEntry = {sessionId: overlayId, session: ongoingOverlay};
    const patchedEntries = baseEntries.some(
      entry => entry.sessionId === overlayId,
    )
      ? baseEntries.map(entry =>
          entry.sessionId === overlayId ? liveEntry : entry,
        )
      : [...baseEntries, liveEntry];

    const newMarking = sessionsToDayMarking(
      patchedEntries.map(entry => entry.session),
      effectivePreferences,
    );
    const patchedCell: DayCellData = newMarking
      ? {marking: newMarking.marking, units: newMarking.units}
      : {marking: {color: paletteGreen}};
    const newUnits = newMarking?.units ?? 0;
    const oldUnits = unitsMap.get(dayKey) ?? 0;

    const nextUnitsMap = new Map(unitsMap);
    nextUnitsMap.set(dayKey, newUnits);

    const nextMonthlyTotalsMap = new Map(monthlyTotalsMap);
    nextMonthlyTotalsMap.set(
      monthKey,
      (monthlyTotalsMap.get(monthKey) ?? 0) - oldUnits + newUnits,
    );

    const nextSessionEntriesByDay = new Map(sessionEntriesByDay);
    nextSessionEntriesByDay.set(dayKey, patchedEntries);

    const nextCalendarMonths = calendarMonths.map(monthData => {
      if (monthData.monthKey !== monthKey) {
        return monthData;
      }
      const nextDayData = new Map(monthData.dayData);
      nextDayData.set(dayKey, patchedCell);
      const nextEntriesByDay = new Map(monthData.entriesByDay);
      nextEntriesByDay.set(dayKey, patchedEntries);
      return {
        ...monthData,
        dayData: nextDayData,
        entriesByDay: nextEntriesByDay,
        totalUnits: monthData.totalUnits - oldUnits + newUnits,
      };
    });

    return {
      calendarMonths: nextCalendarMonths,
      markedDates: {
        ...markedDates,
        [dayKey]: patchedCell.marking,
      },
      unitsMap: nextUnitsMap,
      monthlyTotalsMap: nextMonthlyTotalsMap,
      sessionEntriesByDay: nextSessionEntriesByDay,
    };
  }, [
    ongoingOverlay,
    calendarMonths,
    markedDates,
    unitsMap,
    monthlyTotalsMap,
    sessionEntriesByDay,
    effectivePreferences,
    paletteGreen,
    defaultTimezone,
  ]);

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
    markedDates: overlaidMarkedDates,
    unitsMap: overlaidUnitsMap,
    monthlyTotalsMap: overlaidMonthlyTotalsMap,
    sessionEntriesByDay: overlaidSessionEntriesByDay,
    // Per-month render payloads for the fullscreen week-list, ascending. Month
    // objects keep referential identity across widens (and across live-drink
    // taps, for all but the overlay's month).
    calendarMonths: overlaidCalendarMonths,
    loadedFrom,
    loadedFromDate,
    loadMoreMonths,
    loadUpTo,
    // `true` only for the viewed user with a canonical `earliest_session_at`
    // (self). The orchestrator uses this to pick which load-older guard applies:
    // a hard month floor for self, or the window-exhaustion signal for friends.
    hasPersistedFloor,
    // For friends (no canonical floor): `true` once scrolling back can reveal
    // nothing older — an empty/denied read, or the earliest loaded session
    // already sits above the loaded window edge. Always `false` for self.
    isWindowExhausted,
    isLoading: false,
  };
}

export default useLazyMarkedDates;
export type {UseLazyMarkedDatesOptions};
