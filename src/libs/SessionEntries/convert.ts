import CONST from '@src/CONST';
import type {DrinkKey, DrinksList} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type SessionEntries from '@src/types/onyx/SessionEntries';
import type {SessionEntry} from '@src/types/onyx/SessionEntries';
import {legacyEntryId} from './legacyEntryId';

const DRINK_KEYS: ReadonlySet<string> = new Set(
  Object.values(CONST.DRINKS.KEYS),
);

/** Whether a string is one of the known drink keys. */
function isDrinkKey(key: string): key is DrinkKey {
  return DRINK_KEYS.has(key);
}

/** A positive, finite number; anything else is treated as absent. */
function positiveFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

/** A finite number; anything else is treated as absent. */
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

type NormalizedBucketEntry = {
  count: number;
  volume_ml?: number;
  abv?: number;
};

/**
 * Narrow one legacy bucket value (`number | {count, volume_ml?, abv?}`) into
 * a count plus optional overrides. Returns `null` for anything that is not a
 * positive, finite count: on-disk data has been touched by many app versions,
 * so the shape is checked at runtime rather than trusted from the type.
 */
function normalizeBucketEntry(raw: unknown): NormalizedBucketEntry | null {
  if (typeof raw === 'number') {
    const count = positiveFinite(raw);
    return count === undefined ? null : {count};
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as {count?: unknown; volume_ml?: unknown; abv?: unknown};
    const count = positiveFinite(obj.count);
    if (count === undefined) {
      return null;
    }
    const entry: NormalizedBucketEntry = {count};
    const volumeMl = finite(obj.volume_ml);
    if (volumeMl !== undefined) {
      entry.volume_ml = volumeMl;
    }
    const abv = finite(obj.abv);
    if (abv !== undefined) {
      entry.abv = abv;
    }
    return entry;
  }
  return null;
}

/**
 * Convert legacy `drinks[timestamp][drinkKey]` buckets into Sessions v2
 * entries (RFC §11): one entry per bucket key, `source: 'phone'`,
 * `author_uid === target_uid === owner`, `created_at` from the bucket
 * timestamp, and the deterministic id from `legacyEntryId`.
 *
 * Lossless for every drink: a bucket key with a zero, negative or malformed
 * count carries no drink and is dropped, as is a key that is not a known
 * drink type or a timestamp that is not a finite number. Per-bucket
 * `volume_ml` / `abv` overrides are carried over unchanged.
 *
 * The kiroku-cli backfill copies this conversion; both are pinned to the
 * same fixture (`__tests__/fixtures/legacySessionEntries.ts`).
 */
function legacyBucketsToEntries(
  drinks: DrinksList | undefined,
  ownerUid: UserID,
): SessionEntries {
  const entries: SessionEntries = {};
  if (!drinks) {
    return entries;
  }
  for (const [tsKey, bucket] of Object.entries(drinks)) {
    const ts = Number(tsKey);
    if (!Number.isFinite(ts) || !bucket) {
      continue;
    }
    for (const [key, raw] of Object.entries(bucket)) {
      if (!isDrinkKey(key)) {
        continue;
      }
      const normalized = normalizeBucketEntry(raw);
      if (!normalized) {
        continue;
      }
      const entry: SessionEntry = {
        ts,
        key,
        count: normalized.count,
        source: CONST.SESSION.ENTRY_SOURCE.PHONE,
        author_uid: ownerUid,
        target_uid: ownerUid,
        created_at: ts,
      };
      if (normalized.volume_ml !== undefined) {
        entry.volume_ml = normalized.volume_ml;
      }
      if (normalized.abv !== undefined) {
        entry.abv = normalized.abv;
      }
      entries[legacyEntryId(ts, key)] = entry;
    }
  }
  return entries;
}

export {isDrinkKey, legacyBucketsToEntries, normalizeBucketEntry};
