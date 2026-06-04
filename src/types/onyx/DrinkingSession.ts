import type CONST from '@src/CONST';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import type {Timestamp, UserID} from './OnyxCommon';
import type {DrinksList} from './Drinks';
import type {SelectedTimezone} from './UserData';

/** Options denoting how drinks should be added to an object of drinks */
type AddDrinksOptions =
  | {
      /** An option for when drinks should be added under the current timestamp */
      timestampOption: 'now';
    }
  | {
      /** An option for when drinks should be added to the session start time */
      timestampOption: 'sessionStartTime';

      /** The start time of the session to which the drinks should be added to */
      start_time: Timestamp;
    }
  | {
      /** An option for when drinks should be added to the session end time */
      timestampOption: 'sessionEndTime';

      /** The end time of the session to which the drinks should be added to */
      end_time: number;
    };

/** Options denoting how drinks should be removed */
type RemoveDrinksOptions = 'removeFromLatest' | 'removeFromEarliest';

/**
 * Per-drink-timestamp local calendar fields, precomputed once in the session's
 * timezone so the Statistics cold path reads them with zero `Intl` work. Keys
 * are intentionally terse — this is a persisted, network-synced wire format and
 * a heavy user can accumulate thousands of timestamps.
 *
 * `localMonth` is intentionally not stored: it is `localDay.slice(0, 7)`, a free
 * string slice at read time.
 */
type StoredLocalParts = {
  /** `localDay` — `yyyy-MM-dd` in the session timezone. */
  d: string;
  /** `localHour` — 0..23 in the session timezone. */
  h: number;
  /** `localIsoWeek` — ISO-8601 week label `RRRR-Www` in the session timezone. */
  w: string;
  /** Calendar day of week, 0=Sunday..6=Saturday (weekStart-independent). */
  dow: number;
};

/**
 * Precomputed local fields for every drink timestamp in a session.
 *
 * `tz` records the timezone the fields were computed under. The read path only
 * trusts `byTs` when `tz` matches the session's current timezone; on a mismatch
 * (or for any timestamp missing from `byTs`) it recomputes from the raw stamp,
 * so a stale or partial map can never serve a wrong value — only a slower one.
 */
type SessionTimeParts = {
  /** IANA timezone these parts were computed under. */
  tz: string;
  /** Keyed by the same ms-timestamp keys as `DrinkingSession.drinks`. */
  byTs: Record<Timestamp, StoredLocalParts>;
};

/** A drinking session unique identifier */
type DrinkingSessionId = string;

/** A drinking session type */
type DrinkingSessionType = DeepValueOf<typeof CONST.SESSION.TYPES>;

/** A model for a drinking session */
type DrinkingSession = {
  /** A unique identifier of the drinking session, used only locally */
  id?: DrinkingSessionId;

  /** A UNIX timestamp representing the start time of the session */
  start_time: Timestamp;

  /** A UNIX timestamp representing the end time of the session */
  end_time?: Timestamp;

  /** The timezone where this session took place */
  timezone?: SelectedTimezone;

  /** The drinks recorded during the session */
  drinks?: DrinksList;

  /**
   * Precomputed local calendar fields per drink timestamp, in the session's
   * timezone. Maintained on save (`saveDrinkingSessionData`) and backfilled
   * lazily; absence is fine — the Statistics read path recomputes from `drinks`.
   */
  drinksTimeParts?: SessionTimeParts;

  /** Whether or not the user had a blackout during the session */
  blackout?: boolean;

  /** A private note */
  note?: string;

  /** Whether or not the session is still going on */
  ongoing?: boolean;

  /** The type of this session */
  type?: DrinkingSessionType;
};

/** A collection of drinking sessions */
type DrinkingSessionList = Record<DrinkingSessionId, DrinkingSession>;

/** An array of drinking sessions */
type DrinkingSessionArray = DrinkingSession[];

/** A collection of drinking sessions of multiple users */
type UserDrinkingSessionsList = Record<UserID, DrinkingSessionList>;

export default DrinkingSession;
export type {
  AddDrinksOptions,
  DrinkingSessionArray,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkingSessionType,
  RemoveDrinksOptions,
  SessionTimeParts,
  StoredLocalParts,
  UserDrinkingSessionsList,
};
