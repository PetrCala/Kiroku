import {useEffect, useMemo, useState} from 'react';
import {InteractionManager} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {buildDrinkEvents} from '@libs/Statistics';
import type {DrinkEvent, WeekStart} from '@libs/Statistics';
import Statistics from '@libs/actions/Statistics';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
  DrinkingSessionList,
  UserDrinkingSessionsList,
} from '@src/types/onyx/DrinkingSession';
import type {UserID} from '@src/types/onyx/OnyxCommon';

type UseDrinkEventsOptions = {
  /**
   * Restrict the materialised stream to sessions whose `start_time` (ms) is in
   * `[startMs, endMs]`. The home scorecard passes its visible + previous month
   * so the launch-path walk stays ~2 months wide instead of the whole history
   * (it only ever reads those two months — see `buildMonthlyStats`). Full-stream
   * consumers (Statistics tabs, Badges, drill-down) omit it.
   *
   * IMPORTANT — why the bounds are primitives and the filtering happens inside
   * the rebuild effect (not via a `useMemo` object fed into the effect deps):
   * a render-derived object in the dependency array churns identity every
   * render (under React Compiler it keys on the fresh `{window}` object the
   * caller passes), which re-fires the effect → `setState` → re-render → re-fire
   * into an infinite rebuild loop. That loop saturated the JS interaction queue
   * and starved every async-gated screen (the #1414 regression reverted in
   * Kiroku #1417). Depending only on the stable numeric bounds keeps it stable.
   */
  window?: {startMs: number; endMs: number};
};

type UseDrinkEventsResult = {
  events: DrinkEvent[];
  isLoading: boolean;
  /**
   * The viewed user's first-ever session `start_time` (ms), from a cheap numeric
   * scan (no `Intl`). Populated only when a `window` is supplied — it lets a
   * windowed caller keep a correct comparison baseline even though the event
   * stream is scoped. `undefined` with no window / no sessions.
   */
  earliestStartMs?: number;
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

// Backstop for the deferred rebuild. `runAfterInteractions` normally fires the
// moment the navigation transition settles (~300ms), so this only matters when
// the interaction queue is starved by a leaked handle — then the rebuild runs
// at the latest this long after the inputs changed, instead of never. Kept
// comfortably above a typical transition so the happy path always wins the race
// and the heavy walk never lands mid-transition.
const REBUILD_BACKSTOP_MS = 1000;

function resolveWeekStart(label: string | undefined): WeekStart {
  if (!label) {
    return DEFAULT_WEEK_START;
  }
  return WEEK_START_BY_LABEL[label] ?? DEFAULT_WEEK_START;
}

/**
 * Keep only sessions whose `start_time` falls in `[startMs, endMs]`. Pure, and
 * deliberately called *inside* the rebuild (never in render) so its fresh-object
 * output never reaches the effect's dependency array — see `UseDrinkEventsOptions`.
 * `buildDrinkEvents` / `buildMonthlyStats` window by `start_time`, so filtering
 * by the same numeric bound is lossless for the monthly summary.
 */
function filterSessionsToWindow(
  sessions: UserDrinkingSessionsList,
  startMs: number,
  endMs: number,
): UserDrinkingSessionsList {
  const scoped: UserDrinkingSessionsList = {};
  for (const uid of Object.keys(sessions)) {
    const userSessions = sessions[uid];
    if (!userSessions) {
      continue;
    }
    const kept: DrinkingSessionList = {};
    let keptAny = false;
    for (const sessionId of Object.keys(userSessions)) {
      const session = userSessions[sessionId];
      if (!session) {
        continue;
      }
      const startTime = Number(session.start_time);
      if (
        Number.isFinite(startTime) &&
        startTime >= startMs &&
        startTime <= endMs
      ) {
        kept[sessionId] = session;
        keptAny = true;
      }
    }
    if (keptAny) {
      scoped[uid] = kept;
    }
  }
  return scoped;
}

/**
 * Subscribe to the inputs of the Statistics v2 event stream and return the
 * materialised `DrinkEvent[]` for the requested users.
 *
 * Sessions live on Onyx (`CACHED_DRINKING_SESSIONS`); preferences and the
 * user's timezone come from `useCurrentUserPreferences` / `useCurrentUserData`.
 * `buildDrinkEvents` walks every session × drink timestamp and is the
 * dominant Statistics-tab cost, so we defer the first pass past the
 * navigation transition with `InteractionManager.runAfterInteractions` —
 * the freshly-mounted tab paints skeletons in one frame, then the real
 * events arrive on a later frame. A `setTimeout` backstop runs alongside it so
 * the rebuild always lands even if the interaction queue is starved (otherwise
 * a post-save recompute can be dropped and the overview stays stale until the
 * app is reloaded). Per-tap live edits never reach this path — they mutate
 * `ONGOING_SESSION_DATA`, not the cached snapshot — so this stays off the
 * drink-logging touch frame.
 *
 * Pass `options.window` to scope the walk to a date range (the home scorecard
 * does; everyone else omits it and gets the full stream).
 *
 * `isLoading` is true until the Onyx subscription has hydrated **and** the
 * deferred compute has produced its first result. During that window
 * `events` is `[]`. Callers should render a layout-faithful skeleton, not
 * the empty-state.
 */
function useDrinkEvents(
  userIds?: UserID[],
  options?: UseDrinkEventsOptions,
): UseDrinkEventsResult {
  const {auth} = useFirebase();
  const preferences = useCurrentUserPreferences();
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

  // Read the window as primitives — these (not a derived object) drive the
  // effect below; see `UseDrinkEventsOptions` for why.
  const windowStartMs = options?.window?.startMs;
  const windowEndMs = options?.window?.endMs;

  // Current user's all-time earliest `start_time` (numeric, no `Intl`) — the
  // windowed scorecard's comparison-baseline fallback. Its own memo: returns a
  // number, is never in the effect deps, so it can't drive a rebuild loop even
  // if it recomputes.
  const earliestStartMs = useMemo<number | undefined>(() => {
    if (windowStartMs === undefined || !allSessions || !currentUserID) {
      return undefined;
    }
    const userSessions = allSessions[currentUserID];
    if (!userSessions) {
      return undefined;
    }
    let earliest = Infinity;
    for (const sessionId of Object.keys(userSessions)) {
      const startTime = Number(userSessions[sessionId]?.start_time);
      if (Number.isFinite(startTime) && startTime < earliest) {
        earliest = startTime;
      }
    }
    return earliest === Infinity ? undefined : earliest;
  }, [allSessions, windowStartMs, currentUserID]);

  const [allEvents, setAllEvents] = useState<DrinkEvent[]>(EMPTY_EVENTS);
  const [isCompiled, setIsCompiled] = useState(false);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    let done = false;
    let handle: {cancel?: () => void} | undefined;
    let backstop: ReturnType<typeof setTimeout> | undefined;

    // Whichever of the two timers wins runs the rebuild exactly once; the loser
    // is cancelled. We prefer `runAfterInteractions` (keeps the heavy walk off
    // the navigation-transition frame) but can't depend on it alone: a leaked
    // interaction handle starves its queue indefinitely, which would silently
    // drop a post-save recompute and leave Home/Stats stale until an app reload.
    const rebuild = () => {
      if (done) {
        return;
      }
      done = true;
      handle?.cancel?.();
      if (backstop) {
        clearTimeout(backstop);
      }

      // Apply the window HERE, not via a memo feeding the effect deps (see
      // `UseDrinkEventsOptions`). With no window we pass `allSessions` untouched,
      // so the full-stream consumers and the `backfillSessionTimeParts` contract
      // stay byte-identical.
      const scopedSessions =
        windowStartMs !== undefined && windowEndMs !== undefined && allSessions
          ? filterSessionsToWindow(allSessions, windowStartMs, windowEndMs)
          : allSessions;

      const next = buildDrinkEvents(
        scopedSessions,
        drinksToUnits,
        CONST.DRINK_DEFAULTS,
        timezone,
        weekStart,
      );
      setAllEvents(next);
      setIsCompiled(true);

      // Persist the local fields any session was just forced to recompute, so
      // the next cold open reads them with zero `Intl`. Reconstructed from the
      // events above (no extra `Intl`); the merge re-fires this effect, which
      // then reads the stored fields and produces an empty patch — so it
      // converges in one step and never loops. Scoped to the same windowed set,
      // so a windowed caller keeps whole-history `Intl` off the launch path (the
      // rest is backfilled when a full-stream consumer such as the Statistics
      // tab runs).
      Statistics.backfillSessionTimeParts(
        next,
        scopedSessions,
        timezone,
        weekStart,
      );
    };

    handle = InteractionManager.runAfterInteractions(rebuild);
    backstop = setTimeout(rebuild, REBUILD_BACKSTOP_MS);

    return () => {
      done = true;
      handle?.cancel?.();
      if (backstop) {
        clearTimeout(backstop);
      }
    };
  }, [
    isHydrated,
    allSessions,
    windowStartMs,
    windowEndMs,
    drinksToUnits,
    timezone,
    weekStart,
  ]);

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

  return {events, isLoading, earliestStartMs};
}

export default useDrinkEvents;
export {resolveWeekStart};
export type {UseDrinkEventsResult, UseDrinkEventsOptions};
