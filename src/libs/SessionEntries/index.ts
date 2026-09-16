import type {DrinkingSession} from '@src/types/onyx';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {
  SessionEntry,
  SessionEntryId,
} from '@src/types/onyx/SessionEntries';
import {legacyBucketsToEntries} from './convert';
import {isSchemaV2Session} from './schema';

/** An entry together with its key in the `entries` map. */
type SessionEntryWithId = SessionEntry & {id: SessionEntryId};

/**
 * Owner uid used for a legacy conversion when the caller does not know the
 * owner. No unit, count or calendar computation reads `author_uid` or
 * `target_uid`, so callers that only sum drinks may omit the owner; callers
 * that attribute entries (Statistics, the backfill) must pass it.
 */
const UNKNOWN_OWNER: UserID = '';

// Onyx hands out a new object whenever a session changes, so identity is a
// safe cache key: a session object never mutates after it is read. The inner
// map is keyed by owner uid because the legacy conversion stamps the owner
// onto every entry; in practice a session is read for one owner.
const cache = new WeakMap<DrinkingSession, Map<UserID, SessionEntryWithId[]>>();

function compareEntries(a: SessionEntryWithId, b: SessionEntryWithId): number {
  if (a.ts !== b.ts) {
    return a.ts - b.ts;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

function isLiveEntry(entry: SessionEntry | undefined): entry is SessionEntry {
  return (
    !!entry &&
    entry.deleted !== true &&
    typeof entry.ts === 'number' &&
    Number.isFinite(entry.ts) &&
    typeof entry.count === 'number' &&
    Number.isFinite(entry.count) &&
    entry.count > 0
  );
}

function computeEntries(
  session: DrinkingSession,
  ownerUid: UserID,
): SessionEntryWithId[] {
  const map = isSchemaV2Session(session)
    ? session.entries ?? {}
    : legacyBucketsToEntries(session.drinks, ownerUid);
  const result: SessionEntryWithId[] = [];
  for (const [id, entry] of Object.entries(map)) {
    if (isLiveEntry(entry)) {
      result.push({...entry, id});
    }
  }
  result.sort(compareEntries);
  return result;
}

/**
 * The read adapter (RFC §11): the drinks of any session as entries, sorted
 * by time then id.
 *
 * - A v2 session yields its `entries` minus tombstones (`deleted: true`).
 * - A legacy session yields one entry per `drinks[timestamp][drinkKey]`
 *   bucket key, converted by `legacyBucketsToEntries` with a deterministic id.
 *
 * Entries with a non-finite `ts` or a non-positive `count` are skipped in
 * both shapes. Pure and memoised on the session object's identity, so
 * repeated reads of the same Onyx value cost nothing; the returned array is
 * shared and must not be mutated.
 */
function getSessionEntries(
  session: DrinkingSession | null | undefined,
  ownerUid: UserID = UNKNOWN_OWNER,
): SessionEntryWithId[] {
  if (!session) {
    return [];
  }
  let byOwner = cache.get(session);
  if (!byOwner) {
    byOwner = new Map();
    cache.set(session, byOwner);
  }
  const cached = byOwner.get(ownerUid);
  if (cached) {
    return cached;
  }
  const entries = computeEntries(session, ownerUid);
  byOwner.set(ownerUid, entries);
  return entries;
}

/** The entries of a session for one drink type. */
function getSessionEntriesOfType(
  session: DrinkingSession | null | undefined,
  key: DrinkKey,
): SessionEntryWithId[] {
  return getSessionEntries(session).filter(entry => entry.key === key);
}

export {getSessionEntries, getSessionEntriesOfType};
export {isLegacySession, isSchemaV2Session} from './schema';
export {legacyBucketsToEntries, normalizeBucketEntry} from './convert';
export {LEGACY_ENTRY_ID_PREFIX, legacyEntryId} from './legacyEntryId';
export {entrySdu, entryUnits, sumEntryCounts, sumEntryUnits} from './units';
export type {DrinkDefaults} from './units';
export type {SessionEntryWithId};
