import type CONST from '@src/CONST';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import type {DrinkKey} from './Drinks';
import type {Timestamp, UserID} from './OnyxCommon';

/**
 * A session entry identifier. New entries use a client-generated push id
 * (`generatePushID`), so they sort by creation time and can be minted offline.
 * Entries converted from legacy `drinks[timestamp][drinkKey]` buckets use the
 * deterministic id from `SessionEntries/legacyEntryId`.
 */
type SessionEntryId = string;

/** Where an entry was logged from (RFC §4.3). */
type SessionEntrySource = DeepValueOf<typeof CONST.SESSION.ENTRY_SOURCE>;

/**
 * Whose drink an entry is: a member's uid, or `'unclaimed'` for a drink logged
 * for someone who has not joined (or claimed it) yet.
 */
// `UserID` is a string, so TypeScript widens this union; the sentinel is kept
// in the type on purpose because it documents the one non-uid value.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type SessionEntryTarget = UserID | typeof CONST.SESSION.ENTRY_TARGET_UNCLAIMED;

/**
 * One drink event inside a session (Sessions v2, RFC §4.3). Replaces the
 * `drinks[timestamp][drinkKey]` bucket: every drink has its own identity,
 * timestamp, source and optional volume/ABV. Keys are never removed from the
 * `entries` map; a deleted entry keeps its key as a tombstone.
 */
type SessionEntry = {
  /** When the drink happened (ms, skew-corrected). Retro-add is allowed. */
  ts: Timestamp;

  /** The drink type */
  key: DrinkKey;

  /** How many drinks of `key` this entry stands for */
  count: number;

  /** Per-entry volume override in millilitres; falls back to `CONST.DRINK_DEFAULTS` */
  volume_ml?: number;

  /** Per-entry ABV override as a fraction (0..1); falls back to `CONST.DRINK_DEFAULTS` */
  abv?: number;

  /** Where the entry was logged from */
  source: SessionEntrySource;

  /** Who logged it */
  author_uid: UserID;

  /** Whose drink it is. In a solo session `author_uid === target_uid === owner` */
  target_uid: SessionEntryTarget;

  /** Entries created by one "add to all" round share this id */
  round_id?: string;

  /** Server time the entry was created (ms) */
  created_at: Timestamp;

  /** Server time of the last edit (ms) */
  edited_at?: Timestamp;

  /** Tombstone. The key stays; the entry no longer counts. */
  deleted?: true;

  /** Arrived after the close, inside the grace window (RFC §6) */
  late?: true;

  /** A round drink its target declined; it returns to `'unclaimed'` */
  declined?: true;
};

/** The entries of a session, keyed by entry id */
type SessionEntries = Record<SessionEntryId, SessionEntry>;

export default SessionEntries;
export type {
  SessionEntry,
  SessionEntryId,
  SessionEntrySource,
  SessionEntryTarget,
};
