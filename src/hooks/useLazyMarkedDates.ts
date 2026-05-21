import {useEffect, useMemo, useRef, useState} from 'react';
import {toZonedTime} from 'date-fns-tz';
import type {
  DrinkingSessionArray,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';
import CONST from '@src/CONST';
import {
  eachDayOfInterval,
  format,
  isWithinInterval,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import {sessionsToDayMarking} from '@libs/DataHandling';
import {resolvePalette} from '@libs/SessionColorPalettes';
import type {MarkingProps} from 'react-native-calendars/src/calendar/day/marking';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import * as Calendar from '@userActions/Calendar';
import {useFirebase} from '@context/global/FirebaseContext';
import type {UserID, DateString} from '@src/types/onyx/OnyxCommon';
import {useIsFocused} from '@react-navigation/native';

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
  const {auth} = useFirebase();
  const user = auth?.currentUser;
  const isFocused = useIsFocused();
  const [monthsLoaded] = useOnyx(ONYXKEYS.SESSIONS_CALENDAR_MONTHS_LOADED);
  const defaultTimezone = CONST.DEFAULT_TIME_ZONE.selected;

  // For a different user (e.g. friend profile) start fresh; otherwise resume from the saved scroll depth.
  const initialMonths = user?.uid !== userID ? 0 : monthsLoaded ?? 0;
  const [loadedMonths, setLoadedMonths] = useState<number>(initialMonths);

  // Resync `loadedMonths` if the source user changes or Onyx delivers a different saved scroll depth.
  useEffect(() => {
    setLoadedMonths(user?.uid !== userID ? 0 : monthsLoaded ?? 0);
  }, [userID, user?.uid, monthsLoaded]);

  // Synchronously derive markedDates + unitsMap from the inputs.
  // No effect, no setState — the next render has the new payload.
  const {markedDatesMap, unitsMap, loadedFromDate} = useMemo(() => {
    const today = new Date();
    const start = subDays(startOfMonth(subMonths(today, loadedMonths)), 1);
    const end = today;

    const sessionIndex = new Map<DateString, DrinkingSessionArray>();
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
        const existing = sessionIndex.get(dayKey);
        if (existing) {
          existing.push(session);
        } else {
          sessionIndex.set(dayKey, [session]);
        }
      });

    const newMarkedDatesMap = new Map<DateString, MarkingProps>();
    const newUnitsMap = new Map<DateString, number>();
    const palette = resolvePalette(preferences.session_color_palette);

    eachDayOfInterval({start, end}).forEach(day => {
      const dayKey = format(day, CONST.DATE.FNS_FORMAT_STRING) as DateString;
      const dailySessions = sessionIndex.get(dayKey) ?? [];
      const newMarking = sessionsToDayMarking(dailySessions, preferences);
      if (!newMarking) {
        newMarkedDatesMap.set(dayKey, {color: palette.green});
        return;
      }
      newMarkedDatesMap.set(dayKey, newMarking.marking);
      newUnitsMap.set(dayKey, newMarking.units);
    });

    return {
      markedDatesMap: newMarkedDatesMap,
      unitsMap: newUnitsMap,
      loadedFromDate: start,
    };
  }, [sessions, preferences, loadedMonths, defaultTimezone]);

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

  const loadMoreMonths = (newMonthsToLoad = 1) => {
    setLoadedMonths(prev => prev + newMonthsToLoad);
  };

  // On blur, persist the user's scroll depth so the next mount can resume.
  useEffect(() => {
    if (isFocused) {
      return;
    }
    if (user?.uid === userID) {
      Calendar.setSessionsCalendarMonthsLoaded(loadedMonths);
    }
  }, [isFocused, user?.uid, userID, loadedMonths]);

  return {
    markedDates,
    unitsMap,
    loadedFrom,
    loadMoreMonths,
    isLoading: false,
  };
}

export default useLazyMarkedDates;
