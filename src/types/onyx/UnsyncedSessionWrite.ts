import type DrinkingSession from './DrinkingSession';
import type {DrinkingSessionId} from './DrinkingSession';
import type {Timestamp, UserID} from './OnyxCommon';

/**
 * A finalized session write the request queue permanently dropped (the server
 * deterministically rejected it after retries; transient failures are never
 * dropped). Unlike a live-session flush, nothing later re-sends a finalize,
 * so the payload is parked here instead of being lost: the next app run
 * re-enqueues it once (`resendUnsyncedSessionWrites`), and a successful
 * delivery clears the entry.
 *
 * Cleared on sign-out along with the persisted request queue (neither is in
 * `KEYS_TO_PRESERVE`), so entries always belong to the signed-in user.
 */
type UnsyncedSessionWrite = {
  /** Id of the session the dropped write was for. */
  sessionId: DrinkingSessionId;

  /** The full session payload exactly as the dropped request carried it. */
  session: DrinkingSession;

  /** Owner of the session (the signed-in user at enqueue time). */
  userID: UserID;

  /** Whether the original write was flagged live (mirrors into user status). */
  sessionIsLive: boolean;

  /** When the original write was enqueued (epoch ms), for debugging. */
  enqueuedAt: Timestamp;
};

/** All parked session writes, keyed by session id. */
type UnsyncedSessionWriteList = Record<DrinkingSessionId, UnsyncedSessionWrite>;

export default UnsyncedSessionWrite;
export type {UnsyncedSessionWriteList};
