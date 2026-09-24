import {startOfMonth, subMonths} from 'date-fns';
import CONST from '@src/CONST';
import type {UserID} from '@src/types/onyx/OnyxCommon';

/**
 * How far back a user's sessions are known to be loaded on this device.
 *
 * App open no longer ships the whole history (RFC §10): `GET /v1/app/open`
 * takes a `sessionsFrom` floor and the client widens on demand, through the
 * calendar's month windows (`useDrinkingSessionsFetch`) and the feed's pages
 * (`useSessionFeed`), all of which merge into the one
 * `cachedDrinkingSessions[uid]` map. Every one of those reads is anchored at
 * "now" or at the oldest session already held, so the map is always a
 * contiguous run from the newest session down to some floor. This module
 * remembers that floor per user, so a screen that needs a window the map
 * already covers does not fetch it again, and a re-baseline asks for at least
 * what the device already had.
 *
 * In memory on purpose: it describes THIS run's map. A cold start re-seeds the
 * map from app open and re-notes the floor with it.
 */
const loadedFrom = new Map<UserID, number>();

/**
 * The app-open floor: the start of the month `SESSIONS_INITIAL_FETCH_MONTHS`
 * back, the same window the calendar's first friend fetch uses, so Home's
 * compact calendar, its month overview and their look-ahead buffer are all
 * covered by the snapshot.
 */
function getBootSessionsFrom(now: Date = new Date()): number {
  return startOfMonth(
    subMonths(now, CONST.SESSIONS_INITIAL_FETCH_MONTHS),
  ).getTime();
}

/**
 * The floor to ask a full re-baseline for: the boot floor, or deeper when the
 * device has already loaded further back, so the replace never drops history
 * the calendar or the feed is showing.
 */
function getSnapshotSessionsFrom(
  userID: UserID | undefined,
  now: Date = new Date(),
): number {
  const boot = getBootSessionsFrom(now);
  const current = userID ? loadedFrom.get(userID) : undefined;
  return current === undefined ? boot : Math.min(boot, current);
}

/** A snapshot with this floor is on its way: it REPLACES the map, so this sets. */
function noteSnapshotWindow(userID: UserID, from: number): void {
  loadedFrom.set(userID, from);
}

/** A read merged sessions down to `from`: the floor only ever deepens. */
function noteLoadedBackTo(userID: UserID, from: number): void {
  const current = loadedFrom.get(userID);
  if (current === undefined || from < current) {
    loadedFrom.set(userID, from);
  }
}

/** Whether every session started at or after `from` is already loaded. */
function isLoadedFrom(userID: UserID, from: number): boolean {
  const current = loadedFrom.get(userID);
  return current !== undefined && current <= from;
}

/** Forget every floor (tests). */
function resetSessionWindows(): void {
  loadedFrom.clear();
}

export {
  getBootSessionsFrom,
  getSnapshotSessionsFrom,
  noteSnapshotWindow,
  noteLoadedBackTo,
  isLoadedFrom,
  resetSessionWindows,
};
