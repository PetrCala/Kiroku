import {
  differenceInCalendarMonths,
  format,
  parseISO,
  startOfDay,
} from 'date-fns';
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import {setSessionsCalendarMonthsLoadedForUser} from '@libs/actions/Calendar';
import Statistics from '@libs/actions/Statistics';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {shiftRange} from '@libs/Statistics/trends';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {StatisticsFilters} from '@src/types/onyx';
import derivePresetRange from './derivePresetRange';
import type {
  Comparison,
  Range,
  RangePreset,
  SetRangeInput,
  StatsContextValue,
} from './types';

const DATE_FORMAT = CONST.DATE.FNS_FORMAT_STRING;

const DEFAULT_PRESET: Exclude<RangePreset, 'Custom'> = 'M';
const EMPTY_DRINK_FILTER: ReadonlySet<DrinkKey> = new Set();

type StatsStateContextValue = {
  range: Range;
  /** Calendar-aligned previous-period window, or null when comparison is off. */
  comparisonRange: {start: Date; end: Date} | null;
  comparison: Comparison;
  drinkTypeFilter: ReadonlySet<DrinkKey>;
  liveOnly: boolean;
  userIds: readonly UserID[];
};

type StatsActionsContextValue = {
  setRange: (next: SetRangeInput) => void;
  goToPreviousPeriod: () => void;
  goToNextPeriod: () => void;
  goToLatest: () => void;
  /**
   * Leave the `Custom` range, returning to the pageable preset that was active
   * when `Custom` was selected (falls back to the default preset). The target
   * period is the one holding the custom range's start. No-op off `Custom`.
   */
  revertFromCustom: () => void;
  setComparison: (next: Comparison) => void;
  setDrinkTypeFilter: (next: ReadonlySet<DrinkKey>) => void;
  setLiveOnly: (next: boolean) => void;
  setUserIds: (next: readonly UserID[]) => void;
};

/**
 * Whether the window at `offset` still overlaps the user's recorded history.
 * Pure so it can be reused by both the `range` memo and the nav actions.
 */
function canStepBack(params: {
  preset: RangePreset;
  now: Date;
  offset: number;
  customStart?: Date;
  customEnd?: Date;
  earliestSessionAt?: Date;
}): boolean {
  const {preset, earliestSessionAt} = params;
  if (
    preset === 'All' ||
    preset === 'Custom' ||
    earliestSessionAt === undefined
  ) {
    return false;
  }
  return (
    derivePresetRange(params).end.getTime() >=
    startOfDay(earliestSessionAt).getTime()
  );
}

/**
 * Offset of the pageable window that contains `target`, found by walking back
 * from the current period. Windows are contiguous and descending, so the first
 * window whose start is at or before `target` is the one holding it. Clamped by
 * `canStepBack` so it never lands earlier than the oldest window still
 * overlapping recorded history (e.g. when a custom range starts before the
 * user's first session). Returns `0` for non-pageable presets.
 */
function offsetForDate(params: {
  preset: RangePreset;
  now: Date;
  target: Date;
  earliestSessionAt?: Date;
}): number {
  const {preset, now, target, earliestSessionAt} = params;
  if (preset === 'All' || preset === 'Custom') {
    return 0;
  }
  const targetTime = target.getTime();
  let offset = 0;
  while (
    derivePresetRange({preset, now, offset}).start.getTime() > targetTime
  ) {
    const next = offset - 1;
    if (!canStepBack({preset, now, offset: next, earliestSessionAt})) {
      return offset;
    }
    offset = next;
  }
  return offset;
}

/**
 * Whole calendar months from `start` up to `now`, clamped to ≥0. Used to size
 * the session-listener fetch window so it covers the selected range.
 */
function monthsBackFor(now: Date, start: Date): number {
  return Math.max(0, differenceInCalendarMonths(now, start));
}

/** How many preset-periods make up a year — used for `previous-year` shifts. */
const PERIODS_PER_YEAR: Record<RangePreset, number> = {
  W: 52,
  M: 12,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '6M': 2,
  Y: 1,
  All: 1,
  Custom: 1,
};

/**
 * Comparison window for the active range. For calendar presets this is the
 * *full previous calendar period* (e.g. "this year so far" → all of last year,
 * "this month" → all of last month), so the comparison total matches what you
 * see navigating to that period. `previous-year` steps back a whole year's
 * worth of periods. Custom/All have no calendar-period notion, so they fall
 * back to `shiftRange`'s same-length trailing window.
 */
function deriveComparisonRange(params: {
  range: Range;
  comparison: Comparison;
  now: Date;
  customStart?: Date;
  customEnd?: Date;
  earliestSessionAt?: Date;
}): {start: Date; end: Date} | null {
  const {range, comparison, now, customStart, customEnd, earliestSessionAt} =
    params;
  if (comparison === 'none') {
    return null;
  }
  if (range.preset === 'Custom' || range.preset === 'All') {
    return shiftRange(range, comparison);
  }
  const step =
    comparison === 'previous-year' ? PERIODS_PER_YEAR[range.preset] : 1;
  return derivePresetRange({
    preset: range.preset,
    now,
    offset: range.offset - step,
    customStart,
    customEnd,
    earliestSessionAt,
  });
}

const StatsStateContext = createContext<StatsStateContextValue | null>(null);
const StatsActionsContext = createContext<StatsActionsContextValue | null>(
  null,
);

type StatsContextProviderProps = {
  children: React.ReactNode;
  /** Injectable "now" for tests. Snapshotted on mount; stable across renders. */
  now?: Date;
};

function StatsContextProvider({children, now}: StatsContextProviderProps) {
  const currentUserData = useCurrentUserData();
  const {auth} = useFirebase();
  const firebaseUid = auth?.currentUser?.uid;
  const [persisted] = useOnyx(ONYXKEYS.STATISTICS_FILTERS, {
    canBeMissing: true,
  });
  const [cachedSessionsByUser] = useOnyx(ONYXKEYS.CACHED_DRINKING_SESSIONS, {
    canBeMissing: true,
  });
  const [monthsLoaded] = useOnyx(
    `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${
      firebaseUid ?? ''
    }`,
    {canBeMissing: true},
  );

  // Snapshot "now" once on mount so the derived range stays stable across
  // re-renders. Callers that need a refreshed window can remount the
  // provider (e.g. via a key on screen entry).
  const [nowSnapshot] = useState<Date>(() => now ?? new Date());

  const earliestTs = currentUserData?.earliest_session_at;
  const loadedSessions = firebaseUid
    ? cachedSessionsByUser?.[firebaseUid]
    : undefined;
  // Fall back to the earliest loaded session when the server-backfilled
  // `earliest_session_at` isn't available yet (legacy accounts before the
  // one-time backfill) so the period-nav arrows stay alive from loaded data.
  const loadedEarliestTs = useMemo(
    () => DSUtils.getEarliestSessionStartTime(loadedSessions),
    [loadedSessions],
  );
  const earliestSessionAt = useMemo<Date | undefined>(() => {
    const ts = typeof earliestTs === 'number' ? earliestTs : loadedEarliestTs;
    return typeof ts === 'number' ? new Date(ts) : undefined;
  }, [earliestTs, loadedEarliestTs]);

  const initialPreset = persisted?.preset ?? DEFAULT_PRESET;
  const initialCustomStart = persisted?.customStart
    ? parseISO(persisted.customStart)
    : undefined;
  const initialCustomEnd = persisted?.customEnd
    ? parseISO(persisted.customEnd)
    : undefined;

  const [preset, setPreset] = useState<RangePreset>(initialPreset);
  const [customRange, setCustomRange] = useState<
    {start: Date; end: Date} | undefined
  >(
    initialCustomStart && initialCustomEnd
      ? {start: initialCustomStart, end: initialCustomEnd}
      : undefined,
  );
  // The pageable preset to fall back to when reverting out of `Custom`.
  // Persisted alongside the custom range so the revert target survives a
  // restart while the user is on a custom range.
  const [presetBeforeCustom, setPresetBeforeCustom] = useState<
    Exclude<RangePreset, 'Custom'> | undefined
  >(persisted?.presetBeforeCustom);

  const [drinkTypeFilter, setDrinkTypeFilterState] = useState<
    ReadonlySet<DrinkKey>
  >(() =>
    persisted?.drinkTypeFilter && persisted.drinkTypeFilter.length > 0
      ? new Set(persisted.drinkTypeFilter)
      : EMPTY_DRINK_FILTER,
  );

  // Derived straight from Onyx (not mirrored into useState) so it restores on a
  // cold load even when Onyx hydrates after this provider mounts — a useState
  // initializer would capture the default and never catch up. Absent value
  // defaults to live-only on: the time-of-day charts are only meaningful for
  // real-time timestamps.
  const liveOnly = persisted?.liveOnly ?? true;

  // periodOffset, comparison and userIds intentionally do NOT rehydrate from
  // Onyx — they are transient view state, reset on every mount.
  const [periodOffset, setPeriodOffset] = useState(0);
  const [comparison, setComparison] = useState<Comparison>('none');
  const [userIds, setUserIds] = useState<readonly UserID[]>(() =>
    firebaseUid ? [firebaseUid] : [],
  );

  const customStart = customRange?.start;
  const customEnd = customRange?.end;
  const range = useMemo<Range>(() => {
    const pageable = preset !== 'All' && preset !== 'Custom';
    return {
      ...derivePresetRange({
        preset,
        now: nowSnapshot,
        offset: periodOffset,
        customStart,
        customEnd,
        earliestSessionAt,
      }),
      preset,
      offset: periodOffset,
      isPageable: pageable,
      canGoPrev: canStepBack({
        preset,
        now: nowSnapshot,
        offset: periodOffset - 1,
        customStart,
        customEnd,
        earliestSessionAt,
      }),
      canGoNext: pageable && periodOffset < 0,
      isLatest: periodOffset === 0,
    };
  }, [
    preset,
    periodOffset,
    nowSnapshot,
    customStart,
    customEnd,
    earliestSessionAt,
  ]);

  const comparisonRange = useMemo(
    () =>
      deriveComparisonRange({
        range,
        comparison,
        now: nowSnapshot,
        customStart,
        customEnd,
        earliestSessionAt,
      }),
    [range, comparison, nowSnapshot, customStart, customEnd, earliestSessionAt],
  );

  // Widen the session fetch window so Statistics reflect the whole selected
  // range (and its comparison window), not just the months the calendar
  // happened to lazy-load. Reuses the calendar's months-back lever
  // (`useDrinkingSessionsFetch` re-subscribes when it grows) and only ever
  // widens.
  const loadStart = useMemo(() => {
    const rawStart =
      comparisonRange && comparisonRange.start < range.start
        ? comparisonRange.start
        : range.start;
    // Never widen the shared calendar-depth lever past the user's first
    // session. A comparison window — and the `All` preset — can sit a full
    // span *before* `earliest_session_at`; there are no sessions to fetch
    // there, and the calendar reuses this lever to size its day-key build, so
    // an unclamped value inflates that build to years of empty months.
    if (earliestSessionAt && rawStart < earliestSessionAt) {
      return earliestSessionAt;
    }
    return rawStart;
  }, [range.start, comparisonRange, earliestSessionAt]);

  useEffect(() => {
    if (!firebaseUid) {
      return;
    }
    const required = monthsBackFor(nowSnapshot, loadStart);
    if (required > (monthsLoaded ?? 0)) {
      setSessionsCalendarMonthsLoadedForUser(firebaseUid, required);
    }
  }, [firebaseUid, loadStart, nowSnapshot, monthsLoaded]);

  const setRange = useCallback(
    (next: SetRangeInput) => {
      if (next.preset === 'Custom') {
        const patch: Partial<StatisticsFilters> = {
          preset: 'Custom',
          customStart: format(next.start, DATE_FORMAT),
          customEnd: format(next.end, DATE_FORMAT),
        };
        // Remember the preset we're leaving so the revert button can return to
        // it. Only capture when entering Custom from a pageable preset —
        // re-picking a range while already on Custom keeps the original.
        if (preset !== 'Custom') {
          setPresetBeforeCustom(preset);
          patch.presetBeforeCustom = preset;
        }
        setPeriodOffset(0);
        setCustomRange({start: next.start, end: next.end});
        setPreset('Custom');
        Statistics.setFilters(patch);
        return;
      }
      // Leaving Custom for a pageable preset: land on the window that holds the
      // custom range's start rather than snapping back to the current period.
      // Any other preset→preset change still returns to the current period.
      setPeriodOffset(
        preset === 'Custom' && customRange
          ? offsetForDate({
              preset: next.preset,
              now: nowSnapshot,
              target: customRange.start,
              earliestSessionAt,
            })
          : 0,
      );
      setPreset(next.preset);
      // Clear the custom dates and remembered preset — they're only meaningful
      // for the Custom preset.
      Statistics.setFilters({
        preset: next.preset,
        customStart: undefined,
        customEnd: undefined,
        presetBeforeCustom: undefined,
      });
    },
    [preset, customRange, nowSnapshot, earliestSessionAt],
  );

  const revertFromCustom = useCallback(() => {
    setRange({preset: presetBeforeCustom ?? DEFAULT_PRESET});
  }, [presetBeforeCustom, setRange]);

  const goToPreviousPeriod = useCallback(() => {
    setPeriodOffset(current => {
      const next = current - 1;
      return canStepBack({
        preset,
        now: nowSnapshot,
        offset: next,
        customStart,
        customEnd,
        earliestSessionAt,
      })
        ? next
        : current;
    });
  }, [preset, nowSnapshot, customStart, customEnd, earliestSessionAt]);

  const goToNextPeriod = useCallback(() => {
    setPeriodOffset(current => Math.min(0, current + 1));
  }, []);

  const goToLatest = useCallback(() => setPeriodOffset(0), []);

  const setDrinkTypeFilter = useCallback((next: ReadonlySet<DrinkKey>) => {
    setDrinkTypeFilterState(next);
    Statistics.setFilters({drinkTypeFilter: Array.from(next)});
  }, []);

  // Write-through: Onyx is the source of truth, so persisting the value is all
  // that's needed — the `persisted` subscription above re-renders with it.
  const setLiveOnly = useCallback((next: boolean) => {
    Statistics.setFilters({liveOnly: next});
  }, []);

  const stateValue = useMemo<StatsStateContextValue>(
    () => ({
      range,
      comparisonRange,
      comparison,
      drinkTypeFilter,
      liveOnly,
      userIds,
    }),
    [range, comparisonRange, comparison, drinkTypeFilter, liveOnly, userIds],
  );

  const actionsValue = useMemo<StatsActionsContextValue>(
    () => ({
      setRange,
      goToPreviousPeriod,
      goToNextPeriod,
      goToLatest,
      revertFromCustom,
      setComparison,
      setDrinkTypeFilter,
      setLiveOnly,
      setUserIds,
    }),
    [
      setRange,
      goToPreviousPeriod,
      goToNextPeriod,
      goToLatest,
      revertFromCustom,
      setDrinkTypeFilter,
      setLiveOnly,
    ],
  );

  return (
    <StatsStateContext.Provider value={stateValue}>
      <StatsActionsContext.Provider value={actionsValue}>
        {children}
      </StatsActionsContext.Provider>
    </StatsStateContext.Provider>
  );
}

StatsContextProvider.displayName = 'StatsContextProvider';

export default StatsContextProvider;
export {StatsStateContext, StatsActionsContext, monthsBackFor};
export type {
  StatsContextProviderProps,
  StatsContextValue,
  StatsStateContextValue,
  StatsActionsContextValue,
};
