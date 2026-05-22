import {formatInTimeZone} from 'date-fns-tz';
import type {DrinkingSessionList} from '@src/types/onyx/DrinkingSession';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

/**
 * Count sessions per day, bucketed by `session.start_time` in the session's
 * own timezone (falling back to `timezone`). Ongoing sessions are excluded.
 *
 * Sessions are bucketed by start_time rather than per-drink timestamp so a
 * single session spanning midnight counts once for the day it started —
 * matches the user's mental model ("Friday night's session").
 *
 * Pure: no Onyx, no module-level state.
 */
function buildSessionCountsByDay(
  sessions: DrinkingSessionList | undefined,
  timezone: SelectedTimezone,
): Record<string, number> {
  if (!sessions) {
    return {};
  }

  const counts: Record<string, number> = {};
  for (const session of Object.values(sessions)) {
    if (!session || session.ongoing === true) {
      continue;
    }
    const startMs = Number(session.start_time);
    if (!Number.isFinite(startMs)) {
      continue;
    }
    const sessionTz = session.timezone ?? timezone;
    let dateKey: string;
    try {
      dateKey = formatInTimeZone(startMs, sessionTz, 'yyyy-MM-dd');
    } catch {
      continue;
    }
    counts[dateKey] = (counts[dateKey] ?? 0) + 1;
  }
  return counts;
}

export default buildSessionCountsByDay;
