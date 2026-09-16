import type CONST from '@src/CONST';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import type {Timestamp, UserID} from './OnyxCommon';
import type {DrinksList} from './Drinks';
import type SessionEntries from './SessionEntries';
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

/** The schema version of a Sessions v2 session (RFC §4.2) */
type SessionSchemaVersion = typeof CONST.SESSION.SCHEMA_VERSION;

/** Who may see a session (RFC §4.2) */
type SessionVisibility = DeepValueOf<typeof CONST.SESSION.VISIBILITY>;

/** A session photo identifier */
type SessionPhotoId = string;

/** A photo attached to a session (RFC §4.2) */
type SessionPhoto = {
  /** Storage path of the image */
  path: string;

  /** Pixel width */
  w: number;

  /** Pixel height */
  h: number;

  /** When the photo was added (ms) */
  added_at: Timestamp;

  /** Who added it */
  added_by: UserID;
};

/** The photos of a session, keyed by photo id */
type SessionPhotos = Record<SessionPhotoId, SessionPhoto>;

/**
 * Session meta (RFC §4.2): the fields a solo session and a shared session have
 * in common. `note` and `blackout` are deliberately absent; they stay private
 * per member and live only in each member's own record.
 */
type SessionMeta = {
  /** Marks a Sessions v2 session; its drinks live in `entries` */
  schema_version: SessionSchemaVersion;

  /** Auto-generated default ("Friday evening", localized), editable */
  name: string;

  /** Who may see the session */
  visibility: SessionVisibility;

  /** A UNIX timestamp representing the start time of the session */
  start_time: Timestamp;

  /** A UNIX timestamp representing the end time of the session */
  end_time: Timestamp;

  /** Whether or not the session is still going on */
  ongoing: boolean;

  /** The timezone where this session took place */
  timezone: SelectedTimezone;

  /** Set by the stale-session sweep when the server closed the session */
  auto_closed?: boolean;

  /** Photos attached to the session */
  photos?: SessionPhotos;

  /** Shared sessions only: the admin's uid */
  admin_uid?: UserID;

  /** Shared sessions only: whether members may invite others (default true) */
  members_can_invite?: boolean;

  /** Shared sessions only: server time of the admin's close, for the late-entry rule */
  closed_at?: Timestamp;
};

/** A member's role in a shared session (RFC §4.4) */
type SessionMemberRole = DeepValueOf<typeof CONST.SESSION.MEMBER_ROLE>;

/** A member's status in a shared session (RFC §4.4) */
type SessionMemberStatus = DeepValueOf<typeof CONST.SESSION.MEMBER_STATUS>;

/** How a member joined a shared session (RFC §4.4) */
type SessionJoinedVia = DeepValueOf<typeof CONST.SESSION.JOINED_VIA>;

/** A member of a shared session (RFC §4.4) */
type SessionMember = {
  /** Admin or member */
  role: SessionMemberRole;

  /** Invited, active, left or removed */
  status: SessionMemberStatus;

  /** When the member joined (ms) */
  joined_at?: Timestamp;

  /** How the member got in */
  joined_via?: SessionJoinedVia;

  /** Who invited the member */
  invited_by?: UserID;
};

/** The members of a shared session, keyed by uid */
type SessionMembers = Record<UserID, SessionMember>;

/**
 * The canonical shared session document at `shared_sessions/{sessionId}`
 * (RFC §4.1, decision 19): meta, members and every member's entries. Written
 * only by the server.
 */
type SharedSession = SessionMeta & {
  /** Every member, including former ones */
  members: SessionMembers;

  /** Every entry of every member, tombstones included */
  entries?: SessionEntries;
};

/** A model for a drinking session */
type DrinkingSession = {
  /** A unique identifier of the drinking session, used only locally */
  id?: DrinkingSessionId;

  /**
   * Sessions v2 marker (RFC §4.2). Present and `2` on a v2 session, whose
   * drinks live in `entries`; absent on a legacy session, whose drinks live in
   * `drinks`. Narrow with `isSchemaV2Session` / `isLegacySession`.
   */
  schema_version?: SessionSchemaVersion;

  /** Auto-generated default ("Friday evening", localized), editable. v2 only. */
  name?: string;

  /** Who may see the session. v2 only. */
  visibility?: SessionVisibility;

  /** Photos attached to the session. v2 only. */
  photos?: SessionPhotos;

  /** Set by the stale-session sweep when the server closed the session */
  auto_closed?: boolean;

  /**
   * The drinks of a v2 session, one entry per drink event, tombstones
   * included. Read through `SessionEntries.getSessionEntries`, never directly.
   * May be absent on a v2 session that has no entries yet (RTDB drops empty
   * maps).
   */
  entries?: SessionEntries;

  /**
   * Projection of a shared session (RFC §4.5): this record is the server's
   * per-member copy of `shared_sessions/{sessionId}`, holding only this
   * member's entries.
   */
  shared?: true;

  /** Shared sessions only: the admin's uid */
  admin_uid?: UserID;

  /** Shared sessions only: whether members may invite others (default true) */
  members_can_invite?: boolean;

  /** Shared sessions only: server time of the admin's close */
  closed_at?: Timestamp;

  /** A UNIX timestamp representing the start time of the session */
  start_time: Timestamp;

  /** A UNIX timestamp representing the end time of the session */
  end_time?: Timestamp;

  /** The timezone where this session took place */
  timezone?: SelectedTimezone;

  /**
   * The drinks recorded during a legacy session, keyed by timestamp. Absent on
   * a v2 session (see `entries`). Read through `SessionEntries.getSessionEntries`.
   */
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

/**
 * A Sessions v2 session: `schema_version` is `2` and the drinks live in
 * `entries`. `entries` stays optional because RTDB drops an empty map, so a
 * freshly started v2 session arrives without the key.
 */
type DrinkingSessionV2 = DrinkingSession & {
  /** Always `2` on a v2 session */
  schema_version: SessionSchemaVersion;

  /** A v2 session never carries legacy buckets */
  drinks?: never;
};

/** A legacy session: no `schema_version`, drinks in `drinks` buckets. */
type LegacyDrinkingSession = DrinkingSession & {
  /** Never set on a legacy session */
  schema_version?: never;

  /** A legacy session never carries entries */
  entries?: never;
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
  DrinkingSessionV2,
  LegacyDrinkingSession,
  RemoveDrinksOptions,
  SessionJoinedVia,
  SessionMember,
  SessionMemberRole,
  SessionMembers,
  SessionMemberStatus,
  SessionMeta,
  SessionPhoto,
  SessionPhotoId,
  SessionPhotos,
  SessionSchemaVersion,
  SessionTimeParts,
  SessionVisibility,
  SharedSession,
  StoredLocalParts,
  UserDrinkingSessionsList,
};
