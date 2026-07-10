import type {Timestamp} from './OnyxCommon';
import type {DrinkingSessionId} from './DrinkingSession';

/**
 * Persisted sync bookkeeping for the device-local live-session buffer
 * (`ONGOING_SESSION_DATA`). Live drink taps write only the local buffer and a
 * debounced `UPDATE_SESSION` request; the cached snapshot deliberately gets no
 * optimistic copy of them. This marker records how far that pipeline got so a
 * cold start (especially an offline one) can tell "the buffer holds edits the
 * server has never acknowledged" apart from "the snapshot is at least as fresh
 * as the buffer", and act accordingly: keep the buffer authoritative and
 * re-arm the persist, instead of rolling the buffer back to a stale snapshot.
 */
type OngoingSessionSync = {
  /** The live session these stamps belong to. */
  sessionId: DrinkingSessionId;

  /** Stamp of the newest local edit to the live session buffer. */
  editedAt: Timestamp;

  /**
   * `editedAt` value covered by the most recent enqueued `UPDATE_SESSION`
   * write. Edits with `editedAt > enqueuedAt` were never handed to the request
   * queue (e.g. the app was killed inside the persist debounce window) and
   * must be re-enqueued on the next launch.
   */
  enqueuedAt?: Timestamp;

  /**
   * `editedAt` value most recently acknowledged by a successful
   * `UPDATE_SESSION` response. While `editedAt > syncedAt` the cached snapshot
   * cannot reflect the buffer, so the buffer must not be rolled back to it.
   */
  syncedAt?: Timestamp;
};

export default OngoingSessionSync;
