import type {DrinkingSessionId} from './DrinkingSession';

/**
 * Per session, the server update (`lastUpdateID`) that acknowledged this
 * device's newest write to it (`SESSION_WRITE_ACKS`). Stamped by the success
 * data of every session write, through the
 * `CONST.ONYX_UPDATE_TEMPLATE.LAST_UPDATE_ID` placeholder, and compared with
 * the update the current full sessions snapshot was taken at
 * (`SESSIONS_SNAPSHOT_UPDATE_ID`): a snapshot older than a session's
 * acknowledged write predates that write, so it must not roll the session back
 * or clear it. Both ids are server-issued and monotonic, so the comparison is
 * exact, and both are persisted, so it holds across restarts.
 */
type SessionWriteAckList = Record<DrinkingSessionId, number>;

// eslint-disable-next-line import/prefer-default-export
export type {SessionWriteAckList};
