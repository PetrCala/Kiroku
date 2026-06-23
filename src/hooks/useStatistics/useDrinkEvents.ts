import {useEffect, useMemo, useState} from 'react';
import {InteractionManager} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {buildDrinkEvents} from '@libs/Statistics';
import type {DrinkEvent, WeekStart} from '@libs/Statistics';
import StatsPerf from '@libs/StatsPerf';
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
   * Restrict the materialised stream to sessions whose `start_time` (ms) falls
   * inside `[startMs, endMs]`. The home scorecard passes its visible + previous
   * month so the launch-path walk stays ~2 months wide instead of the whole
   * history (it only ever reads those two months — see `buildMonthlyStats`).
   * Full-stream consumers (Statistics tabs, Badges, drill-down) omit it.
   */
  window?: {startMs: number; endMs: number};
};

type UseDrinkEventsResult = {
  events: DrinkEvent[];
  isLoading: boolean;
  /**
   * The viewed user's first-ever session `start_time` (ms), computed from the
   * full session list with a cheap numeric scan (no `Intl`). Only populated
   * when a `window` is supplied — it lets a windowed caller keep a correct
   * comparison baseline even though the event stream itself is scoped. Falls
   * back to `undefined` (no sessions / no window).
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

  // DIAGNOSTIC A/B lever (StatsPerf): `full` restores the pre-#1414 whole-history
  // backfill even on a windowed caller, so we can test whether dropping it is
  // what slowed profile/friends/calendar — without a rebuild. Defaults to the
  // current (`window`) behaviour.
  const [perfDebug] = useOnyx(ONYXKEYS.NVP_STATS_PERF_DEBUG, {
    canBeMissing: true,
  });
  const backfillFullHistory = perfDebug?.backfillScope === 'full';

  // Scope the sessions fed to the heavy walk to the requested window, if any.
  // `buildDrinkEvents` (and `buildMonthlyStats` downstream) window by a
  // session's `start_time`, so filtering the input by the same numeric bound is
  // lossless — the windowed input yields a byte-identical monthly summary while
  // turning the launch-path walk from O(whole history) into O(window). With no
  // window we return the original `allSessions` reference untouched, so the
  // full-stream consumers and the `backfillSessionTimeParts` contract are
  // unchanged. The pass also tracks the current user's all-time earliest
  // `start_time` (numeric only, no `Intl`) for the comparison-baseline fallback.
  const windowStartMs = options?.window?.startMs;
  const windowEndMs = options?.window?.endMs;
  const {scopedSessions, earliestStartMs} = useMemo<{
    scopedSessions: UserDrinkingSessionsList | undefined;
    earliestStartMs: number | undefined;
  }>(() => {
    if (
      windowStartMs === undefined ||
      windowEndMs === undefined ||
      !allSessions
    ) {
      return {scopedSessions: allSessions, earliestStartMs: undefined};
    }
    let earliest = Infinity;
    const scoped: UserDrinkingSessionsList = {};
    for (const uid of Object.keys(allSessions)) {
      const userSessions = allSessions[uid];
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
        const startMs = Number(session.start_time);
        if (!Number.isFinite(startMs)) {
          continue;
        }
        if (uid === currentUserID && startMs < earliest) {
          earliest = startMs;
        }
        if (startMs >= windowStartMs && startMs <= windowEndMs) {
          kept[sessionId] = session;
          keptAny = true;
        }
      }
      if (keptAny) {
        scoped[uid] = kept;
      }
    }
    return {
      scopedSessions: scoped,
      earliestStartMs: earliest === Infinity ? undefined : earliest,
    };
  }, [allSessions, windowStartMs, windowEndMs, currentUserID]);

  // Sessions the launch-time backfill covers. Same ref as `scopedSessions` in
  // the default (`window`) mode, so behaviour is unchanged; the full set only
  // when the diagnostic lever is flipped.
  const backfillSessions = backfillFullHistory ? allSessions : scopedSessions;

  const [allEvents, setAllEvents] = useState<DrinkEvent[]>(EMPTY_EVENTS);
  const [isCompiled, setIsCompiled] = useState(false);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    // Counts every effect run — a runaway here (see the LOOP flag in the
    // readout) is the JS-thread-saturation signature behind the stuck-skeleton
    // / slow-screen symptoms.
    StatsPerf.inc('useDrinkEvents.effectFire');
    let done = false;
    let handle: {cancel?: () => void} | undefined;
    let backstop: ReturnType<typeof setTimeout> | undefined;

    // Whichever of the two timers wins runs the rebuild exactly once; the loser
    // is cancelled. We prefer `runAfterInteractions` (keeps the heavy walk off
    // the navigation-transition frame) but can't depend on it alone: a leaked
    // interaction handle starves its queue indefinitely, which would silently
    // drop a post-save recompute and leave Home/Stats stale until an app reload.
    const rebuild = (via: 'interaction' | 'backstop') => {
      if (done) {
        return;
      }
      done = true;
      handle?.cancel?.();
      if (backstop) {
        clearTimeout(backstop);
      }
      // Which timer won: a high `via.backstop` rate means the InteractionManager
      // queue is starved (interactions never settle) — the deferred-work
      // starvation that would also strand the calendar's scroll-ready callback.
      StatsPerf.inc('useDrinkEvents.rebuild');
      StatsPerf.inc(`useDrinkEvents.via.${via}`);

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
      // converges in one step and never loops. Scoped to `scopedSessions`: a
      // windowed caller only backfills the sessions it walked, keeping
      // whole-history `Intl` off the launch path (the rest is backfilled when a
      // full-stream consumer such as the Statistics tab runs).
      Statistics.backfillSessionTimeParts(
        next,
        backfillSessions,
        timezone,
        weekStart,
      );
    };

    handle = InteractionManager.runAfterInteractions(() =>
      rebuild('interaction'),
    );
    backstop = setTimeout(() => rebuild('backstop'), REBUILD_BACKSTOP_MS);

    return () => {
      done = true;
      handle?.cancel?.();
      if (backstop) {
        clearTimeout(backstop);
      }
    };
  }, [
    isHydrated,
    scopedSessions,
    backfillSessions,
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
export type {UseDrinkEventsResult};
