import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {SessionEntryId} from '@src/types/onyx/SessionEntries';

/**
 * Prefix of every entry id derived from a legacy `drinks[timestamp][drinkKey]`
 * bucket. New entries use push ids (20 characters, RFC §4.3); a legacy id is
 * longer and self-describing, so the two can never collide.
 */
const LEGACY_ENTRY_ID_PREFIX = 'legacy';

/**
 * The deterministic id of the entry a legacy bucket key converts into. The
 * same `(timestamp, drinkKey)` always yields the same id, so the in-memory
 * adapter and the kiroku-cli backfill (which copies this function and pins
 * both to one fixture) agree on every id, and a session converted twice is
 * identical.
 *
 * Firebase keys may not contain `.`, `#`, `$`, `[`, `]` or `/`; a timestamp
 * and a drink key contain none of these.
 */
function legacyEntryId(ts: number, key: DrinkKey): SessionEntryId {
  return `${LEGACY_ENTRY_ID_PREFIX}-${ts}-${key}`;
}

export {LEGACY_ENTRY_ID_PREFIX, legacyEntryId};
