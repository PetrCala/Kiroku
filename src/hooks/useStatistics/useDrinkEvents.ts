import {useEffect, useState} from 'react';
import {InteractionManager} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {buildDrinkEvents} from '@libs/Statistics';
import type {DrinkEvent, WeekStart} from '@libs/Statistics';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {UserID} from '@src/types/onyx/OnyxCommon';

type UseDrinkEventsResult = {
  events: DrinkEvent[];
  isLoading: boolean;
};

const WEEK_START_BY_LABEL: Record<string, WeekStart> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const DEFAULT_WEEK_START: WeekStart = 1;

const EMPTY_EVENTS: DrinkEvent[] = [];

function resolveWeekStart(label: string | undefined): WeekStart {
  if (!label) {
    return DEFAULT_WEEK_START;
  }
  return WEEK_START_BY_LABEL[label] ?? DEFAULT_WEEK_START;
}

/**
 * Subscribe to the inputs of the Statistics v2 event stream and return the
 * materialised `DrinkEvent[]` for the requested users.
 *
 * Sessions live on Onyx (`CACHED_DRINKING_SESSIONS`); preferences and the
 * user's timezone flow through `DatabaseDataContext` / `useCurrentUserData`.
 * `buildDrinkEvents` walks every session × drink timestamp and is the
 * dominant Statistics-tab cost, so we defer the first pass past the
 * navigation transition with `InteractionManager.runAfterInteractions` —
 * the freshly-mounted tab paints skeletons in one frame, then the real
 * events arrive on a later frame.
 *
 * `isLoading` is true until the Onyx subscription has hydrated **and** the
 * deferred compute has produced its first result. During that window
 * `events` is `[]`. Callers should render a layout-faithful skeleton, not
 * the empty-state.
 */
function useDrinkEvents(userIds?: UserID[]): UseDrinkEventsResult {
  const {auth} = useFirebase();
  const {preferences} = useDatabaseData();
  const userData = useCurrentUserData();
  const [allSessions, allSessionsMeta] = useOnyx(
    ONYXKEYS.CACHED_DRINKING_SESSIONS,
  );

  const currentUserID = auth?.currentUser?.uid;
  const timezone =
    userData?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected;
  const weekStart = resolveWeekStart(preferences?.first_day_of_week);
  const drinksToUnits = preferences?.drinks_to_units;
  const isHydrated = allSessionsMeta.status === 'loaded';

  const [allEvents, setAllEvents] = useState<DrinkEvent[]>(EMPTY_EVENTS);
  const [isCompiled, setIsCompiled] = useState(false);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }
      const next = buildDrinkEvents(
        allSessions,
        drinksToUnits,
        CONST.DRINK_DEFAULTS,
        timezone,
        weekStart,
      );
      setAllEvents(next);
      setIsCompiled(true);
    });
    return () => {
      cancelled = true;
      handle.cancel?.();
    };
  }, [isHydrated, allSessions, drinksToUnits, timezone, weekStart]);

  const resolvedUserIds = userIds ?? (currentUserID ? [currentUserID] : []);

  let events: DrinkEvent[];
  if (!isCompiled || resolvedUserIds.length === 0) {
    events = EMPTY_EVENTS;
  } else if (resolvedUserIds.length === 1) {
    const only = resolvedUserIds[0];
    events = allEvents.filter(e => e.userId === only);
  } else {
    const ids = new Set(resolvedUserIds);
    events = allEvents.filter(e => ids.has(e.userId));
  }

  const isLoading = !isHydrated || !isCompiled;

  return {events, isLoading};
}

export default useDrinkEvents;
export type {UseDrinkEventsResult};
