import DrinkData from '@libs/DrinkData';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import {
  entrySdu,
  getSessionEntries,
  sumEntryCounts,
  sumEntryUnits,
} from '@libs/SessionEntries';
import type {DrinkDefaults} from '@libs/SessionEntries';
import {getSessionDisplayName} from '@libs/SessionName';
import type {
  DrinkingSession,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkKey,
  SessionPhoto,
  SessionPhotoId,
} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';

/** One drink type's share of a session, for the card's icon row. */
type FeedDrinkCount = {
  key: DrinkKey;
  count: number;
};

/**
 * What a feed card shows for one session (RFC §10), computed on the client
 * from the session record at today's scale. Pure data: no strings that need
 * a locale beyond the name, so the card can format the rest itself.
 */
type FeedCardSummary = {
  sessionId: DrinkingSessionId;

  /** The stored name, or the generated default for a session without one. */
  name: string;

  startTime: number;

  /** Whether the session is still running (the card shows a live badge). */
  isLive: boolean;

  /**
   * How long the session ran, or has been running so far for a live one.
   * Never negative: a session whose end sits before its start reads as 0.
   */
  durationMs: number;

  /** Total units by the user's own per-drink factors, 2 decimals. */
  units: number;

  /**
   * Standard drink units from the entries' volume and ABV (or the per-type
   * defaults), 1 decimal. `undefined` when nothing could be resolved.
   */
  sdu: number | undefined;

  /** How many drinks, whatever their type. */
  drinkCount: number;

  /** Per-type counts, non-zero only, in `DrinkData` order. */
  drinkCounts: FeedDrinkCount[];

  /** The first photo of the night, for the thumbnail, when there is one. */
  photoId: SessionPhotoId | undefined;
  photo: SessionPhoto | undefined;
  photoCount: number;

  blackout: boolean;
};

type BuildFeedCardSummaryOptions = {
  /** The viewer's `preferences.drinks_to_units`. Without it units read 0. */
  drinksToUnits: DrinksToUnits | undefined;

  /** `CONST.DRINK_DEFAULTS`, the SDU fallback per drink type. */
  drinkDefaults: DrinkDefaults | undefined;

  /** The session's owner, so a legacy session's entries carry the right author. */
  ownerUid?: UserID;

  /** "Now", for a live session's running duration. */
  now: number;
};

/** The photo that was added first, so the thumbnail is how the night began. */
function firstPhoto(
  session: DrinkingSession,
): [SessionPhotoId, SessionPhoto] | undefined {
  let first: [SessionPhotoId, SessionPhoto] | undefined;
  for (const [photoId, photo] of Object.entries(session.photos ?? {})) {
    if (!first || photo.added_at < first[1].added_at) {
      first = [photoId, photo];
    }
  }
  return first;
}

/**
 * The feed card's numbers for one session, read through the entries adapter
 * (RFC decision 1) so a legacy session and a v2 session summarise identically.
 */
function buildFeedCardSummary(
  sessionId: DrinkingSessionId,
  session: DrinkingSession,
  {drinksToUnits, drinkDefaults, ownerUid, now}: BuildFeedCardSummaryOptions,
): FeedCardSummary {
  const entries = getSessionEntries(session, ownerUid);
  const isLive = session.ongoing === true;
  const end = isLive ? now : session.end_time ?? session.start_time;

  let sdu: number | undefined;
  for (const entry of entries) {
    const entryValue = entrySdu(entry, drinkDefaults);
    if (entryValue !== undefined) {
      sdu = (sdu ?? 0) + entryValue;
    }
  }

  const countsByKey = new Map<DrinkKey, number>();
  for (const entry of entries) {
    countsByKey.set(entry.key, (countsByKey.get(entry.key) ?? 0) + entry.count);
  }
  const drinkCounts: FeedDrinkCount[] = [];
  for (const {key} of DrinkData) {
    const count = countsByKey.get(key) ?? 0;
    if (count > 0) {
      drinkCounts.push({key, count});
    }
  }

  const photo = firstPhoto(session);

  return {
    sessionId,
    name: getSessionDisplayName(session),
    startTime: session.start_time,
    isLive,
    durationMs: Math.max(0, end - session.start_time),
    units: roundToTwoDecimalPlaces(sumEntryUnits(entries, drinksToUnits)),
    sdu: sdu === undefined ? undefined : Math.round(sdu * 10) / 10,
    drinkCount: sumEntryCounts(entries),
    drinkCounts,
    photoId: photo?.[0],
    photo: photo?.[1],
    photoCount: Object.keys(session.photos ?? {}).length,
    blackout: session.blackout === true,
  };
}

/**
 * A session map as the feed lists it: newest first by `start_time`, ties by
 * key so the order is stable across renders and devices.
 */
function sortSessionsNewestFirst(
  sessions: DrinkingSessionList | null | undefined,
): DrinkingSessionKeyValue[] {
  if (!sessions) {
    return [];
  }
  return Object.entries(sessions)
    .filter(([, session]) => Number.isFinite(session?.start_time))
    .map(([sessionId, session]) => ({sessionId, session}))
    .sort(
      (a, b) =>
        b.session.start_time - a.session.start_time ||
        compareKeysDescending(a.sessionId, b.sessionId),
    );
}

function compareKeysDescending(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? 1 : -1;
}

/**
 * The oldest `start_time` the feed has, which is the cursor for the next page
 * (`before`): every session the app holds for a user is a contiguous run from
 * the newest downwards (the boot window, the calendar's month windows and the
 * feed's pages all anchor at "now" or at this value), so nothing older than it
 * is loaded and nothing newer is missing.
 */
function getOldestStartTime(
  items: DrinkingSessionKeyValue[],
): number | undefined {
  return items.length === 0
    ? undefined
    : items[items.length - 1].session.start_time;
}

export {buildFeedCardSummary, sortSessionsNewestFirst, getOldestStartTime};
export type {FeedCardSummary, FeedDrinkCount, BuildFeedCardSummaryOptions};
