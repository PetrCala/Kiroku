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
 * The full event list is built once over the entire Onyx value so
 * `buildDrinkEvents`'s identity cache keeps hitting; the per-call `userIds`
 * filter is applied last.
 *
 * `isLoading` is true until the Onyx subscription has hydrated. During that
 * window `events` is `[]` — callers should render a skeleton, not the
 * empty-state.
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

  const allEvents = buildDrinkEvents(
    allSessions,
    preferences?.drinks_to_units,
    CONST.DRINK_DEFAULTS,
    timezone,
    weekStart,
  );

  const resolvedUserIds = userIds ?? (currentUserID ? [currentUserID] : []);

  let events: DrinkEvent[];
  if (resolvedUserIds.length === 0) {
    events = [];
  } else if (resolvedUserIds.length === 1) {
    const only = resolvedUserIds[0];
    events = allEvents.filter(e => e.userId === only);
  } else {
    const ids = new Set(resolvedUserIds);
    events = allEvents.filter(e => ids.has(e.userId));
  }

  const isLoading = allSessionsMeta.status !== 'loaded';

  return {events, isLoading};
}

export default useDrinkEvents;
export type {UseDrinkEventsResult};
