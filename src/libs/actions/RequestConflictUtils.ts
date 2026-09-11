import type OnyxRequest from '@src/types/onyx/Request';
import type {ConflictActionData} from '@src/types/onyx/Request';

type RequestMatcher = (request: OnyxRequest) => boolean;

/**
 * Merge a queued request's data with a new request's, or return `undefined`
 * when the two can't be merged.
 */
type RequestDataMerger = (
  queued: OnyxRequest,
  incoming: OnyxRequest,
) => Record<string, unknown> | undefined;

/**
 * Determines the appropriate action for handling duplication conflicts in persisted requests.
 *
 * This method checks if any request in the list of persisted requests matches the criteria defined by the request matcher function.
 * - If no match is found, it suggests adding the request to the list, indicating a 'push' action.
 * - If a match is found, it suggests updating the existing entry, indicating a 'replace' action at the found index.
 */
function resolveDuplicationConflictAction(
  persistedRequests: OnyxRequest[],
  requestMatcher: RequestMatcher,
): ConflictActionData {
  const index = persistedRequests.findIndex(requestMatcher);
  if (index === -1) {
    return {
      conflictAction: {
        type: 'push',
      },
    };
  }

  return {
    conflictAction: {
      type: 'replace',
      index,
    },
  };
}

/**
 * The request that replaces `queued` once `incoming` is folded into it.
 *
 * It takes `incoming`'s identity, including its idempotency key. The merge is
 * a new write as far as the server is concerned, so it can never be answered
 * from a record of what `queued` alone said, even if `queued` reached the
 * server before (a lost answer, or an app restart mid-request). That's also why
 * merges must be absolute (later values win), never deltas.
 *
 * Onyx data from both requests is kept: success and finally data run in order,
 * and failure data undoes the newest change first.
 */
function mergeQueuedRequests(
  queued: OnyxRequest,
  incoming: OnyxRequest,
  data: Record<string, unknown>,
): OnyxRequest {
  const merged: OnyxRequest = {
    ...incoming,
    data: {...data, idempotencyKey: incoming.data?.idempotencyKey},
    successData: [
      ...(queued.successData ?? []),
      ...(incoming.successData ?? []),
    ],
    failureData: [
      ...(incoming.failureData ?? []),
      ...(queued.failureData ?? []),
    ],
    finallyData: [
      ...(queued.finallyData ?? []),
      ...(incoming.finallyData ?? []),
    ],
  };
  // Functions can't be persisted with the queue.
  delete merged.checkAndFixConflictingRequest;
  return merged;
}

/**
 * The op coalescer (Sessions v2 RFC §5.3): fold a new request into one that is
 * still waiting in the queue, for example two edits to the same session entry
 * becoming one request.
 *
 * `findCandidateIndex` picks the queued request to try (or -1), and `mergeData`
 * merges the two requests' data, or returns `undefined` when they can't merge.
 * Anything that can't be merged is simply queued.
 *
 * A request that already failed and was put back (`isRollbacked`) is never a
 * candidate: it may be applied on the server already, and it is next in line.
 * The request in flight isn't in the queue at all.
 */
function resolveCoalescingConflictAction(
  persistedRequests: OnyxRequest[],
  newRequest: OnyxRequest,
  findCandidateIndex: (requests: OnyxRequest[]) => number,
  mergeData: RequestDataMerger,
): ConflictActionData {
  const index = findCandidateIndex(persistedRequests);
  const queued = index === -1 ? undefined : persistedRequests.at(index);
  if (!queued || queued.isRollbacked) {
    return {conflictAction: {type: 'push'}};
  }

  const data = mergeData(queued, newRequest);
  if (!data) {
    return {conflictAction: {type: 'push'}};
  }

  return {
    conflictAction: {
      type: 'replace',
      index,
      request: mergeQueuedRequests(queued, newRequest, data),
    },
  };
}

export {
  resolveDuplicationConflictAction,
  resolveCoalescingConflictAction,
  mergeQueuedRequests,
};
export type {RequestMatcher, RequestDataMerger};
