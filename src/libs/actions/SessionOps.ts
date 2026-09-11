import * as API from '@libs/API';
import type {
  SessionOpParams,
  SessionOpPayload,
  SessionOpType,
} from '@libs/API/parameters';
import {WRITE_COMMANDS} from '@libs/API/types';
import Str from '@libs/common/str';
import DateUtils from '@libs/DateUtils';
import * as FeatureFlags from '@libs/FeatureFlags';
import Log from '@libs/Log';
import CONST from '@src/CONST';
import type OnyxRequest from '@src/types/onyx/Request';
import type {OnyxData} from '@src/types/onyx/Request';
import {resolveCoalescingConflictAction} from './RequestConflictUtils';

/** What a caller describes; the helper adds the op id and the timestamp. */
type SessionOp = {
  sessionId: string;
  type: SessionOpType;
  payload?: SessionOpPayload;
};

/** Ops that can absorb a later edit of the same entry. */
const OPS_ABSORBING_ENTRY_EDITS: ReadonlySet<SessionOpType> = new Set([
  CONST.SESSION_OP.TYPE.ADD_ENTRY,
  CONST.SESSION_OP.TYPE.EDIT_ENTRY,
]);

function getEntryID(payload: SessionOpPayload | undefined): string | undefined {
  const entryID = payload?.entryId;
  return typeof entryID === 'string' ? entryID : undefined;
}

/**
 * Fold `incoming` into `queued` when it edits the entry `queued` adds or
 * edits in the same session: the result is `queued`'s type with the fields of
 * both, the later op's values winning, under the later op's id. Returns
 * `undefined` for anything else, which is queued as its own op.
 *
 * Merges are absolute (the later value wins), so a merged op is safe to apply
 * even if the earlier op had already reached the server.
 */
function mergeSessionOps(
  queued: SessionOpParams,
  incoming: SessionOpParams,
): SessionOpParams | undefined {
  if (queued.sessionId !== incoming.sessionId) {
    return undefined;
  }
  const entryID = getEntryID(queued.payload);
  if (!entryID || entryID !== getEntryID(incoming.payload)) {
    return undefined;
  }
  if (
    incoming.type !== CONST.SESSION_OP.TYPE.EDIT_ENTRY ||
    !OPS_ABSORBING_ENTRY_EDITS.has(queued.type)
  ) {
    return undefined;
  }
  return {
    ...incoming,
    type: queued.type,
    payload: {...queued.payload, ...incoming.payload},
  };
}

function getOpParams(
  request: OnyxRequest | undefined,
): SessionOpParams | undefined {
  return request?.command === WRITE_COMMANDS.SESSION_OP
    ? (request.data as SessionOpParams | undefined)
    : undefined;
}

/**
 * Coalesce a new op into the latest queued op of the same session, and only
 * that one: folding into an earlier op would jump the session's ops that were
 * queued in between.
 */
function coalesceWithLatestSessionOp(
  persistedRequests: OnyxRequest[],
  newRequest: OnyxRequest,
) {
  const sessionId = getOpParams(newRequest)?.sessionId;
  return resolveCoalescingConflictAction(
    persistedRequests,
    newRequest,
    requests => {
      for (let index = requests.length - 1; index >= 0; index--) {
        if (getOpParams(requests.at(index))?.sessionId === sessionId) {
          return index;
        }
      }
      return -1;
    },
    (queued, incoming) => {
      const queuedOp = getOpParams(queued);
      const incomingOp = getOpParams(incoming);
      return queuedOp && incomingOp
        ? mergeSessionOps(queuedOp, incomingOp)
        : undefined;
    },
  );
}

/**
 * Send a session op through `API.write`, so it gets optimistic, success and
 * failure data, survives app restarts in the queue, and is replay-safe: the op
 * id doubles as the request's idempotency key. `client_ts` is on the server's
 * clock (`DateUtils.getServerTime`).
 *
 * Groundwork for Sessions v2 (W2 moves session writes onto ops). Off behind
 * the `SESSION_OPS` flag; the server applies only `ping` so far.
 *
 * @returns the op id, or `undefined` when ops are switched off
 */
function sendSessionOp(
  op: SessionOp,
  onyxData: OnyxData = {},
): string | undefined {
  if (!FeatureFlags.isEnabled('SESSION_OPS')) {
    Log.info('[SessionOps] Not sending, SESSION_OPS is off', false, {
      type: op.type,
    });
    return undefined;
  }

  const opId = Str.guid();
  const params: SessionOpParams = {
    opId,
    sessionId: op.sessionId,
    type: op.type,
    payload: op.payload ?? {},
    client_ts: DateUtils.getServerTime(),
    idempotencyKey: opId,
  };
  API.write(WRITE_COMMANDS.SESSION_OP, params, onyxData, {
    checkAndFixConflictingRequest: coalesceWithLatestSessionOp,
  });
  return opId;
}

export {sendSessionOp, mergeSessionOps};
export type {SessionOp};
