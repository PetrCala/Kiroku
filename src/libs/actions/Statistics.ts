import Onyx from 'react-native-onyx';
import StatsPerf from '@libs/StatsPerf';
import {buildTimePartsPatchFromEvents} from '@libs/Statistics/sessionTimeParts';
import type {DrinkEvent, WeekStart} from '@libs/Statistics';
import ONYXKEYS from '@src/ONYXKEYS';
import type {StatisticsFilters} from '@src/types/onyx';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';

/**
 * Merge a patch into the persisted Statistics filter state. The provider
 * holds the React-state source of truth for the current render; this write
 * is best-effort persistence so the user's last range / drink-type
 * selection rehydrates on the next app launch.
 */
function setFilters(patch: Partial<StatisticsFilters>): void {
  Onyx.merge(ONYXKEYS.STATISTICS_FILTERS, patch);
}

/**
 * Persist the precomputed per-drink local time fields that `buildDrinkEvents`
 * had to recompute this pass, so the next cold open reads them with zero `Intl`.
 * The patch is reconstructed from the already-materialised events (no extra
 * `Intl`); it covers only sessions whose stored fields are absent or stale, so
 * a steady state is a no-op and the triggering subscription converges in one
 * step rather than looping.
 */
function backfillSessionTimeParts(
  events: DrinkEvent[],
  sessions: UserDrinkingSessionsList | undefined,
  defaultTimezone: string,
  weekStart: WeekStart,
): void {
  const patch = buildTimePartsPatchFromEvents(
    events,
    sessions,
    defaultTimezone,
    weekStart,
  );
  if (patch) {
    // Each merge bumps CACHED_DRINKING_SESSIONS identity → re-renders/re-derives
    // every subscriber. A high merge rate here is the signature of a backfill
    // write loop (non-converging patch). `sessions` = the per-merge session count.
    StatsPerf.inc('backfill.merge');
    let sessionCount = 0;
    for (const userId of Object.keys(patch)) {
      sessionCount += Object.keys(patch[userId] ?? {}).length;
    }
    StatsPerf.inc('backfill.sessions', sessionCount);
    Onyx.merge(ONYXKEYS.CACHED_DRINKING_SESSIONS, patch);
  } else {
    StatsPerf.inc('backfill.empty');
  }
}

export default {setFilters, backfillSessionTimeParts};
