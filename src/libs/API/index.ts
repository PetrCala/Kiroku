import type {OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import Log from '@libs/Log';
import * as Middleware from '@libs/Middleware';
import * as NetworkStore from '@libs/Network/NetworkStore';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import * as Pusher from '@libs/Pusher/pusher';
import * as Request from '@libs/Request';
import * as PersistedRequests from '@userActions/PersistedRequests';
import CONST from '@src/CONST';
import type OnyxRequest from '@src/types/onyx/Request';
import type {RequestConflictResolver} from '@src/types/onyx/Request';
import type Response from '@src/types/onyx/Response';
import pkg from '../../../package.json';
import type {
  ApiRequest,
  ApiRequestCommandParameters,
  ReadCommand,
  SideEffectRequestCommand,
  WriteCommand,
} from './types';

// Setup API middlewares. Each request made will pass through a series of middleware functions that will get called in sequence (each one passing the result of the previous to the next).
// Note: The ordering here is intentional as we want to Log, Recheck Connection, Reauthenticate, and Save the Response in Onyx. Errors thrown in one middleware will bubble to the next.
// e.g. an error thrown in Logging or Reauthenticate logic will be caught by the next middleware or the SequentialQueue which retries failing requests.

// Logging - Logs request details and errors.
Request.use(Middleware.Logging);

// RecheckConnection - Sets a timer for a request that will "recheck" if we are connected to the internet if time runs out. Also triggers the connection recheck when we encounter any error.
// eslint-disable-next-line react-hooks/rules-of-hooks -- Request.use is not a React hook (name heuristic false positive)
Request.use(Middleware.RecheckConnection);

// Reauthentication - Handles jsonCode 407 (expired Firebase ID token): force-refreshes the token and replays the request.
// eslint-disable-next-line react-hooks/rules-of-hooks -- Request.use is not a React hook (name heuristic false positive)
Request.use(Middleware.Reauthentication);

// SaveResponseInOnyx - Merges either the successData or failureData (or finallyData, if included in place of the former two values) into Onyx depending on if the call was successful or not. This needs to be the LAST middleware we use, don't add any
// middlewares after this, because the SequentialQueue depends on the result of this middleware to pause the queue (if needed) to bring the app to an up-to-date state.
Request.use(Middleware.SaveResponseInOnyx);

// Use timestamp-based IDs to avoid collisions between browser tabs.
// Each tab has its own JS context with its own counter, so a simple
// incrementing number would collide across tabs.
let requestIndex = Date.now();

type OnyxData = {
  optimisticData?: OnyxUpdate[];
  successData?: OnyxUpdate[];
  failureData?: OnyxUpdate[];
  finallyData?: OnyxUpdate[];
};

/**
 * All calls to API.write() will be persisted to disk as JSON with the params, successData, and failureData (or finallyData, if included in place of the former two values).
 * This is so that if the network is unavailable or the app is closed, we can send the WRITE request later.
 *
 * @param command - Name of API command to call.
 * @param apiCommandParameters - Parameters to send to the API.
 * @param onyxData  - Object containing errors, loading states, and optimistic UI data that will be merged
 *                             into Onyx before and after a request is made. Each nested object will be formatted in
 *                             the same way as an API response.
 * @param [onyxData.optimisticData] - Onyx instructions that will be passed to Onyx.update() before the request is made.
 * @param [onyxData.successData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode === 200.
 * @param [onyxData.failureData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode !== 200.
 * @param [onyxData.finallyData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode === 200 or jsonCode !== 200.
 * @param [conflictResolver] - callbacks used in special cases to detect and handle conflicting requests in the sequential queue
 */
function write<TCommand extends WriteCommand>(
  command: TCommand,
  apiCommandParameters: ApiRequestCommandParameters[TCommand],
  onyxData: OnyxData = {},
  conflictResolver: RequestConflictResolver = {},
): Promise<void> {
  Log.info('Called API write', false, {command, ...apiCommandParameters});

  // When a conflict resolver decides this request is a no-op against the queue (e.g. it cancels
  // out a previously queued request), we must NOT apply its optimistic data: there is no request
  // that will later reconcile it, so the optimistic update would never be cleared.
  let shouldApplyOptimisticData = true;
  if (conflictResolver.checkAndFixConflictingRequest) {
    const {conflictAction} = conflictResolver.checkAndFixConflictingRequest(
      PersistedRequests.getAll(),
    );
    shouldApplyOptimisticData = conflictAction.type !== 'noAction';
  }

  const {optimisticData, ...onyxDataWithoutOptimisticData} = onyxData;

  // Optimistically update Onyx
  if (optimisticData && shouldApplyOptimisticData) {
    Onyx.update(optimisticData);
  }

  // Assemble the data we'll send to the API
  const data = {
    ...apiCommandParameters,
    appversion: pkg.version,
    apiRequestType: CONST.API_REQUEST_TYPE.WRITE,

    // We send the pusherSocketID with all write requests so that the api can include it in push events to prevent Pusher from sending the events to the requesting client. The push event
    // is sent back to the requesting client in the response data instead, which prevents a replay effect in the UI. See https://github.com/Expensify/App/issues/12775.
    pusherSocketID: Pusher.getPusherSocketID(),
  };

  // Assemble all the request data we'll be storing in the queue
  const request: OnyxRequest = {
    command,
    data: {
      ...data,

      // This should be removed once we are no longer using deprecatedAPI https://github.com/Expensify/Expensify/issues/215650
      shouldRetry: true,
      canCancel: true,
    },
    initiatedOffline: NetworkStore.isOffline(),
    requestID: requestIndex++,
    ...onyxDataWithoutOptimisticData,
    ...conflictResolver,
  };

  // Write commands can be saved and retried, so push it to the SequentialQueue
  return SequentialQueue.push(request);
}

/**
 * For commands where the network response must be accessed directly or when there is functionality that can only
 * happen once the request is finished (eg. calling third-party services like Onfido and Plaid, redirecting a user
 * depending on the response data, etc.).
 * It works just like API.read(), except that it will return a promise.
 * Using this method is discouraged and will throw an ESLint error. Use it sparingly and only when all other alternatives have been exhausted.
 * It is best to discuss it in Slack anytime you are tempted to use this method.
 *
 * @param command - Name of API command to call.
 * @param apiCommandParameters - Parameters to send to the API.
 * @param onyxData  - Object containing errors, loading states, and optimistic UI data that will be merged
 *                             into Onyx before and after a request is made. Each nested object will be formatted in
 *                             the same way as an API response.
 * @param [onyxData.optimisticData] - Onyx instructions that will be passed to Onyx.update() before the request is made.
 * @param [onyxData.successData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode === 200.
 * @param [onyxData.failureData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode !== 200.
 * @param [onyxData.finallyData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode === 200 or jsonCode !== 200.
 * @param [apiRequestType] - Can be either 'read', 'write', or 'makeRequestWithSideEffects'. We use this to either return the chained
 *                                    response back to the caller or to trigger reconnection callbacks when re-authentication is required.
 * @returns
 */
function makeRequestWithSideEffects<
  TCommand extends SideEffectRequestCommand | WriteCommand | ReadCommand,
>(
  command: TCommand,
  apiCommandParameters: ApiRequestCommandParameters[TCommand],
  onyxData: OnyxData = {},
  apiRequestType: ApiRequest = CONST.API_REQUEST_TYPE
    .MAKE_REQUEST_WITH_SIDE_EFFECTS,
): Promise<void | Response> {
  Log.info('Called API makeRequestWithSideEffects', false, {
    command,
    ...apiCommandParameters,
  });
  const {optimisticData, ...onyxDataWithoutOptimisticData} = onyxData;

  // Optimistically update Onyx
  if (optimisticData) {
    Onyx.update(optimisticData);
  }

  // Assemble the data we'll send to the API
  const data = {
    ...apiCommandParameters,
    appversion: pkg.version,
    apiRequestType,
  };

  // Assemble all the request data we'll be storing
  const request: OnyxRequest = {
    command,
    data,
    initiatedOffline: NetworkStore.isOffline(),
    requestID: requestIndex++,
    ...onyxDataWithoutOptimisticData,
  };

  // Return a promise containing the response from HTTPS
  const responsePromise = Request.processWithMiddleware(request);

  // Read-type requests are fire-and-forget reads: their response is merged into
  // Onyx by the SaveResponseInOnyx middleware, and callers only await them to
  // settle a loading state (`.finally`) — they don't handle the rejection. A
  // non-2xx response rejects this promise (`HttpUtils` throws an `HttpsError`),
  // so an uncaught read rejection escapes as an UNHANDLED promise rejection,
  // which pops the full-screen react-error-overlay on the web dev server (seen
  // as "Uncaught HttpsError: Unauthorized" during the #781 revoked-token QA).
  // Swallow it here: the Logging middleware already logged the failure, the read
  // carried no optimistic data to roll back, and a 401 already triggered the
  // central sign-out in `HttpUtils`. Writes and true side-effect requests keep
  // rejecting so their callers can still handle errors.
  if (apiRequestType === CONST.API_REQUEST_TYPE.READ) {
    return responsePromise.catch((error: unknown): void => {
      Log.info('[API] Swallowed rejected read request', false, {
        command,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return responsePromise;
}

/**
 * Requests made with this method are not be persisted to disk. If there is no network connectivity, the request is ignored and discarded.
 *
 * @param command - Name of API command to call.
 * @param apiCommandParameters - Parameters to send to the API.
 * @param onyxData  - Object containing errors, loading states, and optimistic UI data that will be merged
 *                             into Onyx before and after a request is made. Each nested object will be formatted in
 *                             the same way as an API response.
 * @param [onyxData.optimisticData] - Onyx instructions that will be passed to Onyx.update() before the request is made.
 * @param [onyxData.successData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode === 200.
 * @param [onyxData.failureData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode !== 200.
 * @param [onyxData.finallyData] - Onyx instructions that will be passed to Onyx.update() when the response has jsonCode === 200 or jsonCode !== 200.
 */
function read<TCommand extends ReadCommand>(
  command: TCommand,
  apiCommandParameters: ApiRequestCommandParameters[TCommand],
  onyxData: OnyxData = {},
) {
  // Ensure all write requests on the sequential queue have finished responding before running read requests.
  // Responses from read requests can overwrite the optimistic data inserted by
  // write requests that use the same Onyx keys and haven't responded yet.
  SequentialQueue.waitForIdle()
    .then(() =>
      makeRequestWithSideEffects(
        command,
        apiCommandParameters,
        onyxData,
        CONST.API_REQUEST_TYPE.READ,
      ),
    )
    // `makeRequestWithSideEffects` already swallows a read's non-2xx rejection
    // (see above), so this outer catch is a backstop: it guards against a
    // synchronous throw on the read path (or a future change) ever surfacing as
    // an unhandled rejection — which would pop the web dev-server error overlay.
    .catch((error: unknown) => {
      Log.info('[API] Swallowed rejected read request (queue)', false, {
        command,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

export {write, makeRequestWithSideEffects, read};
