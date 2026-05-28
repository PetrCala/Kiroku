import {format, parseISO, startOfDay} from 'date-fns';
import React, {createContext, useCallback, useMemo, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import Statistics from '@libs/actions/Statistics';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import derivePresetRange from './derivePresetRange';
import type {
  Comparison,
  Range,
  RangePreset,
  SetRangeInput,
  StatsContextValue,
} from './types';

const DATE_FORMAT = CONST.DATE.FNS_FORMAT_STRING;

const DEFAULT_PRESET: RangePreset = 'M';
const EMPTY_DRINK_FILTER: ReadonlySet<DrinkKey> = new Set();

type StatsStateContextValue = {
  range: Range;
  comparison: Comparison;
  drinkTypeFilter: ReadonlySet<DrinkKey>;
  userIds: readonly UserID[];
};

type StatsActionsContextValue = {
  setRange: (next: SetRangeInput) => void;
  goToPreviousPeriod: () => void;
  goToNextPeriod: () => void;
  goToLatest: () => void;
  setComparison: (next: Comparison) => void;
  setDrinkTypeFilter: (next: ReadonlySet<DrinkKey>) => void;
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
  const [persisted] = useOnyx(ONYXKEYS.STATISTICS_FILTERS, {
    canBeMissing: true,
  });

  // Snapshot "now" once on mount so the derived range stays stable across
  // re-renders. Callers that need a refreshed window can remount the
  // provider (e.g. via a key on screen entry).
  const [nowSnapshot] = useState<Date>(() => now ?? new Date());

  const earliestTs = currentUserData?.earliest_session_at;
  const earliestSessionAt = useMemo<Date | undefined>(
    () => (typeof earliestTs === 'number' ? new Date(earliestTs) : undefined),
    [earliestTs],
  );

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

  const [drinkTypeFilter, setDrinkTypeFilterState] = useState<
    ReadonlySet<DrinkKey>
  >(() =>
    persisted?.drinkTypeFilter && persisted.drinkTypeFilter.length > 0
      ? new Set(persisted.drinkTypeFilter)
      : EMPTY_DRINK_FILTER,
  );

  // periodOffset, comparison and userIds intentionally do NOT rehydrate from
  // Onyx — they are transient view state, reset on every mount.
  const [periodOffset, setPeriodOffset] = useState(0);
  const [comparison, setComparison] = useState<Comparison>('none');
  const {auth} = useFirebase();
  const firebaseUid = auth?.currentUser?.uid;
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

  const setRange = useCallback((next: SetRangeInput) => {
    // Any range change returns to the current period.
    setPeriodOffset(0);
    if (next.preset === 'Custom') {
      setCustomRange({start: next.start, end: next.end});
      setPreset('Custom');
      Statistics.setFilters({
        preset: 'Custom',
        customStart: format(next.start, DATE_FORMAT),
        customEnd: format(next.end, DATE_FORMAT),
      });
      return;
    }
    setPreset(next.preset);
    // Clear stored custom dates when switching away — they're only meaningful
    // for the Custom preset.
    Statistics.setFilters({
      preset: next.preset,
      customStart: undefined,
      customEnd: undefined,
    });
  }, []);

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

  const stateValue = useMemo<StatsStateContextValue>(
    () => ({range, comparison, drinkTypeFilter, userIds}),
    [range, comparison, drinkTypeFilter, userIds],
  );

  const actionsValue = useMemo<StatsActionsContextValue>(
    () => ({
      setRange,
      goToPreviousPeriod,
      goToNextPeriod,
      goToLatest,
      setComparison,
      setDrinkTypeFilter,
      setUserIds,
    }),
    [
      setRange,
      goToPreviousPeriod,
      goToNextPeriod,
      goToLatest,
      setDrinkTypeFilter,
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
export {StatsStateContext, StatsActionsContext};
export type {
  StatsContextProviderProps,
  StatsContextValue,
  StatsStateContextValue,
  StatsActionsContextValue,
};
