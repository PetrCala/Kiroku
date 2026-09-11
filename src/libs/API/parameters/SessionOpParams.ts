import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';

/** A session op type (Sessions v2 RFC §5.1). */
type SessionOpType = ValueOf<typeof CONST.SESSION_OP.TYPE>;

/** Per-type op fields, for example `entryId` on the entry ops. */
type SessionOpPayload = Record<string, unknown>;

/** The session op envelope, sent to `POST /v1/sessions/ops`. */
type SessionOpParams = {
  /** Client-generated op id. Also the request's idempotency key. */
  opId: string;

  /** The session the op applies to. */
  sessionId: string;

  /** What the op does. */
  type: SessionOpType;

  /** Per-type fields. */
  payload: SessionOpPayload;

  /** The client's server-time-corrected clock when the op was made (ms). */
  client_ts: number;

  /**
   * Pins the request's idempotency key to `opId`; the server requires them to
   * match. Sent as the `Idempotency-Key` header, not in the body.
   */
  idempotencyKey: string;
};

export default SessionOpParams;
export type {SessionOpPayload, SessionOpType};
