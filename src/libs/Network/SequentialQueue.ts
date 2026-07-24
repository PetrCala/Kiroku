import Onyx from 'react-native-onyx';
import * as ActiveClientManager from '@libs/ActiveClientManager';
import Log from '@libs/Log';
import * as Request from '@libs/Request';
import RequestThrottle from '@libs/RequestThrottle';
import * as PersistedRequests from '@userActions/PersistedRequests';
import * as QueuedOnyxUpdates from '@userActions/QueuedOnyxUpdates';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type OnyxRequest from '@src/types/onyx/Request';
import type {ConflictData} from '@src/types/onyx/Request';
import * as NetworkStore from './NetworkStore';

type RequestError = Error & {
  name?: string;
  message?: string;
  status?: string;
};

let resolveIsReadyPromise: ((args?: unknown[]) => void) | undefined;
let isReadyPromise = new Promise(resolve => {
  resolveIsReadyPromise = resolve;
});

// Resolve the isReadyPromise immediately so that the queue starts working as soon as the page loads
resolveIsReadyPromise?.();

let isSequentialQueueRunning = false;
let currentRequestPromise: Promise<void> | null = null;
let isQueuePaused = false;
const sequentialQueueRequestThrottle = new RequestThrottle('SequentialQueue');

/**
 * Whether a request that exhausted its retry budget may be dropped from the
 * persisted queue. Only a deterministic client error qualifies: an actual
 * server response with a non-retryable 4xx status, meaning the server
 * actively rejected this exact payload and replaying it can never succeed.
 *
 * Everything else is transient by nature: network-layer failures carry no
 * response at all (fetch failure, timeout, a reauth attempt while offline),
 * and 5xx / 429 mean the server itself is unhealthy or throttling. Dropping a
 * persisted write on those destroys user data that would have delivered once
 * conditions recovered (an offline-logged drinking session, for example), so
 * such requests stay queued for the next flush trigger instead.
 */
function isDroppableFailure(error: RequestError): boolean {
  const status = Number(error.status);
  if (!Number.isFinite(status) || status <= 0) {
    // No (parseable) server response: a network-layer failure.
    return false;
  }
  return (
    status >= 400 &&
    status < 500 &&
    status !== CONST.HTTP_STATUS.TOO_MANY_REQUESTS
  );
}

/**
 * Puts the queue into a paused state so that no requests will be processed
 */
function pause() {
  if (isQueuePaused) {
    Log.info('[SequentialQueue] Queue already paused');
    return;
  }

  Log.info('[SequentialQueue] Pausing the queue');
  isQueuePaused = true;
}

/**
 * Gets the current Onyx queued updates, apply them and clear the queue if the queue is not paused.
 */
function flushOnyxUpdatesQueue() {
  // The only situation where the queue is paused is if we found a gap between the app current data state and our server's. If that happens,
  // we'll trigger async calls to make the client updated again. While we do that, we don't want to insert anything in Onyx.
  if (isQueuePaused) {
    Log.info('[SequentialQueue] Queue already paused');
    return;
  }
  QueuedOnyxUpdates.flushQueue();
}

/**
 * Process any persisted requests, when online, one at a time until the queue is empty.
 *
 * If a request fails due to some kind of network error, such as a request being throttled or when our backend is down, then we retry it with an exponential back off process until a response
 * is successfully returned. The first time a request fails we set a random, small, initial wait time. After waiting, we retry the request. If there are subsequent failures the request wait
 * time is doubled creating an exponential back off in the frequency of requests hitting the server. Since the initial wait time is random and it increases exponentially, the load of
 * requests to our backend is evenly distributed and it gradually decreases with time, which helps the servers catch up.
 */
function process(): Promise<void> {
  // When the queue is paused, return early. This prevents any new requests from happening. The queue will be flushed again when the queue is unpaused.
  if (isQueuePaused) {
    Log.info('[SequentialQueue] Unable to process. Queue is paused.');
    return Promise.resolve();
  }

  if (NetworkStore.isOffline()) {
    Log.info('[SequentialQueue] Unable to process. We are offline.');
    return Promise.resolve();
  }

  const persistedRequests = PersistedRequests.getAll();
  if (persistedRequests.length === 0) {
    Log.info('[SequentialQueue] Unable to process. No requests to process.');
    return Promise.resolve();
  }

  const requestToProcess = PersistedRequests.processNextRequest();
  if (!requestToProcess) {
    Log.info('[SequentialQueue] Unable to process. No next request to handle.');
    return Promise.resolve();
  }

  // Set the current request to a promise awaiting its processing so that getCurrentRequest can be used to take some action after the current request has processed.
  currentRequestPromise = Request.processWithMiddleware(requestToProcess, true)
    .then(response => {
      // A response might indicate that the queue should be paused. This happens when a gap in onyx updates is detected between the client and the server and
      // that gap needs resolved before the queue can continue.
      if (response?.shouldPauseQueue) {
        Log.info(
          "[SequentialQueue] Handled 'shouldPauseQueue' in response. Pausing the queue.",
        );
        pause();
      }

      Log.info(
        '[SequentialQueue] Removing persisted request because it was processed successfully.',
        false,
        {request: requestToProcess},
      );
      PersistedRequests.endRequestAndRemoveFromQueue(requestToProcess);
      sequentialQueueRequestThrottle.clear();
      return process();
    })
    .catch((error: RequestError) => {
      // On sign out we cancel any in flight requests from the user. Since that user is no longer signed in their requests should not be retried.
      // Duplicate records don't need to be retried as they just mean the record already exists on the server
      if (
        error.name === CONST.ERROR.REQUEST_CANCELLED ||
        error.message === CONST.ERROR.DUPLICATE_RECORD
      ) {
        Log.info(
          "[SequentialQueue] Removing persisted request because it failed and doesn't need to be retried.",
          false,
          {error, request: requestToProcess},
        );
        PersistedRequests.endRequestAndRemoveFromQueue(requestToProcess);
        sequentialQueueRequestThrottle.clear();
        return process();
      }
      PersistedRequests.rollbackOngoingRequest();
      return sequentialQueueRequestThrottle
        .sleep(error, requestToProcess.command)
        .then(process)
        .catch(() => {
          // The retry budget is exhausted. Drop the request only when the
          // server deterministically rejected it (see `isDroppableFailure`);
          // a transient failure (network-layer, 5xx, 429) keeps the request
          // persisted and stalls the queue until the next flush trigger
          // (reconnection, app foreground, a new write) retries it with a
          // fresh budget. Dropping on transient failures silently destroyed
          // offline-queued session writes during flaky-network windows.
          if (!isDroppableFailure(error)) {
            Log.info(
              '[SequentialQueue] Request failed too many times; keeping it queued for the next flush trigger.',
              false,
              {error, request: requestToProcess},
            );
            sequentialQueueRequestThrottle.clear();
            // Unblock `waitForIdle()` waiters the same way the offline
            // early-return does: the queue is intentionally stalled, and
            // holding reads hostage to an unreachable server helps nobody.
            resolveIsReadyPromise?.();
            return;
          }
          Onyx.update(requestToProcess.failureData ?? []);
          Log.info(
            '[SequentialQueue] Removing persisted request because it failed too many times.',
            false,
            {error, request: requestToProcess},
          );
          PersistedRequests.endRequestAndRemoveFromQueue(requestToProcess);
          sequentialQueueRequestThrottle.clear();
          return process();
        });
    });

  return currentRequestPromise;
}

function flush() {
  // When the queue is paused, return early. This will keep an requests in the queue and they will get flushed again when the queue is unpaused
  if (isQueuePaused) {
    Log.info('[SequentialQueue] Unable to flush. Queue is paused.');
    return;
  }

  if (isSequentialQueueRunning) {
    Log.info('[SequentialQueue] Unable to flush. Queue is already running.');
    return;
  }

  if (PersistedRequests.getAll().length === 0 && QueuedOnyxUpdates.isEmpty()) {
    Log.info(
      '[SequentialQueue] Unable to flush. No requests or queued Onyx updates to process.',
    );
    return;
  }

  // ONYXKEYS.PERSISTED_REQUESTS is shared across clients, thus every client/tab will have a copy
  // It is very important to only process the queue from leader client otherwise requests will be duplicated.
  if (!ActiveClientManager.isClientTheLeader()) {
    Log.info('[SequentialQueue] Unable to flush. Client is not the leader.');
    return;
  }

  isSequentialQueueRunning = true;

  // Reset the isReadyPromise so that the queue will be flushed as soon as the request is finished
  isReadyPromise = new Promise(resolve => {
    resolveIsReadyPromise = resolve;
  });

  // Ensure persistedRequests are read from storage before proceeding with the queue
  const connection = Onyx.connect({
    key: ONYXKEYS.PERSISTED_REQUESTS,
    // We exceptionally opt out of reusing the connection here to avoid extra callback calls due to
    // an existing connection already made in PersistedRequests.ts.
    reuseConnection: false,
    callback: () => {
      Onyx.disconnect(connection);
      process().finally(() => {
        Log.info('[SequentialQueue] Finished processing queue.');
        isSequentialQueueRunning = false;
        if (
          NetworkStore.isOffline() ||
          PersistedRequests.getAll().length === 0
        ) {
          resolveIsReadyPromise?.();
        }
        currentRequestPromise = null;

        // The queue can be paused when we sync the data with backend so we should only update the Onyx data when the queue is empty
        if (PersistedRequests.getAll().length === 0) {
          flushOnyxUpdatesQueue();
        }
      });
    },
  });
}

/**
 * Unpauses the queue and flushes all the requests that were in it or were added to it while paused
 */
function unpause() {
  if (!isQueuePaused) {
    Log.info(
      '[SequentialQueue] Unable to unpause queue. We are already processing.',
    );
    return;
  }

  const numberOfPersistedRequests = PersistedRequests.getAll().length || 0;
  Log.info(
    `[SequentialQueue] Unpausing the queue and flushing ${numberOfPersistedRequests} requests`,
  );
  isQueuePaused = false;
  flush();
}

function isRunning(): boolean {
  return isSequentialQueueRunning;
}

function isPaused(): boolean {
  return isQueuePaused;
}

// Flush the queue when the connection resumes. Each online window also gets a
// fresh retry budget: the throttle counter only resets on success or drop, so
// without this, brief dead windows (VPN black-hole, airplane-mode toggles)
// would each burn a few of the lifetime retries and an offline-queued write
// could exhaust its budget cumulatively across flaps. `resetBudget` (never
// `clear`) so an armed retry timer keeps its resolve.
NetworkStore.onReconnection(() => {
  sequentialQueueRequestThrottle.resetBudget();
  flush();
});

function handleConflictActions(
  conflictAction: ConflictData,
  newRequest: OnyxRequest,
) {
  if (conflictAction.type === 'push') {
    PersistedRequests.save(newRequest);
  } else if (conflictAction.type === 'replace') {
    PersistedRequests.update(
      conflictAction.index,
      conflictAction.request ?? newRequest,
    );
  } else if (conflictAction.type === 'delete') {
    PersistedRequests.deleteRequestsByIndices(conflictAction.indices);
    if (conflictAction.pushNewRequest) {
      PersistedRequests.save(newRequest);
    }
    if (conflictAction.nextAction) {
      handleConflictActions(conflictAction.nextAction, newRequest);
    }
  } else {
    Log.info(
      `[SequentialQueue] No action performed to command ${newRequest.command} and it will be ignored.`,
    );
  }
}

function push(newRequest: OnyxRequest): Promise<void> {
  const {checkAndFixConflictingRequest} = newRequest;

  if (checkAndFixConflictingRequest) {
    const requests = PersistedRequests.getAll();
    const {conflictAction} = checkAndFixConflictingRequest(requests);
    Log.info(
      `[SequentialQueue] Conflict action for command ${newRequest.command} - ${conflictAction.type}:`,
    );

    // don't try to serialize a function.
    // eslint-disable-next-line no-param-reassign
    delete newRequest.checkAndFixConflictingRequest;
    handleConflictActions(conflictAction, newRequest);
  } else {
    // Add request to Persisted Requests so that it can be retried if it fails
    PersistedRequests.save(newRequest);
  }

  // The request is persisted synchronously above, so the returned promise can resolve immediately.
  // If we are offline we don't need to trigger the queue to empty as it will happen when we come back online
  if (NetworkStore.isOffline()) {
    return Promise.resolve();
  }

  // If the queue is running this request will run once it has finished processing the current batch
  if (isSequentialQueueRunning) {
    isReadyPromise.then(flush);
    return Promise.resolve();
  }

  flush();
  return Promise.resolve();
}

function getCurrentRequest(): Promise<void> {
  if (currentRequestPromise === null) {
    return Promise.resolve();
  }
  return currentRequestPromise;
}

/**
 * Returns a promise that resolves when the sequential queue is done processing all persisted write requests.
 */
function waitForIdle(): Promise<unknown> {
  return isReadyPromise;
}

/**
 * Clear any pending requests during test runs
 * This is to prevent previous requests interfering with other tests
 */
function resetQueue(): void {
  isSequentialQueueRunning = false;
  currentRequestPromise = null;
  isQueuePaused = false;
  isReadyPromise = new Promise(resolve => {
    resolveIsReadyPromise = resolve;
  });
  resolveIsReadyPromise?.();
}

export {
  flush,
  getCurrentRequest,
  isRunning,
  isPaused,
  push,
  waitForIdle,
  pause,
  unpause,
  process,
  resetQueue,
  sequentialQueueRequestThrottle,
};
export type {RequestError};
