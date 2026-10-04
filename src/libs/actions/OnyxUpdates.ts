import type {OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import type {Merge} from 'type-fest';
import {SIDE_EFFECT_REQUEST_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import Log from '@libs/Log';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import PusherUtils from '@libs/PusherUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
  OnyxUpdateEvent,
  OnyxUpdatesFromServer,
  Request,
} from '@src/types/onyx';
import type Response from '@src/types/onyx/Response';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import * as QueuedOnyxUpdates from './QueuedOnyxUpdates';

// This key needs to be separate from ONYXKEYS.ONYX_UPDATES_FROM_SERVER so that it can be updated without triggering the callback when the server IDs are updated. If that
// callback were triggered it would lead to duplicate processing of server updates.
let lastUpdateIDAppliedToClient: number | undefined = 0;
Onyx.connect({
  key: ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
  callback: val => (lastUpdateIDAppliedToClient = val),
});

// This promise is used to ensure pusher events are always processed in the order they are received,
// even when such events are received over multiple separate pusher updates.
let pusherEventsPromise = Promise.resolve();

let airshipEventsPromise = Promise.resolve();

/** The response's `lastUpdateID` as a number, or `undefined` when it has none. */
function getResponseUpdateID(response: Response): number | undefined {
  if (response.lastUpdateID === undefined || response.lastUpdateID === null) {
    return undefined;
  }
  const lastUpdateID = Number(response.lastUpdateID);
  return Number.isFinite(lastUpdateID) ? lastUpdateID : undefined;
}

/**
 * Fill in the placeholders a request's success data may carry for values only
 * known once the response arrives (`CONST.ONYX_UPDATE_TEMPLATE`). Requests are
 * persisted as JSON, so a placeholder is a plain string; this walks the update
 * values and swaps it for the response's `lastUpdateID`. A response without a
 * usable id resolves the placeholder to `null`, which a merge treats as
 * "remove the field", so a stamp is never written from a made-up value.
 */
function resolveResponseTemplates(
  updates: OnyxUpdate[],
  response: Response,
): OnyxUpdate[] {
  const lastUpdateID = getResponseUpdateID(response);
  const resolved =
    lastUpdateID !== undefined && lastUpdateID > 0 ? lastUpdateID : null;
  const resolveValue = (value: unknown): unknown => {
    if (value === CONST.ONYX_UPDATE_TEMPLATE.LAST_UPDATE_ID) {
      return resolved;
    }
    if (Array.isArray(value)) {
      return value.map(resolveValue);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          resolveValue(entry),
        ]),
      );
    }
    return value;
  };
  return updates.map(
    update => ({...update, value: resolveValue(update.value)}) as OnyxUpdate,
  );
}

/**
 * Whether a response's onyxData replaces a user's whole sessions snapshot.
 * kiroku-api's `app/open` (and a full reconnect) clean-replace the caller's
 * entry in `cachedDrinkingSessions` with a merge of `null` followed by a merge
 * of the sessions, so the tell is one uid that is set to `null` by one update
 * and to an object by another. A friend's eviction sets a uid to `null` alone,
 * and a session echo nests its `null` one level deeper, so neither matches.
 */
function isFullSessionsSnapshot(onyxData: OnyxUpdate[]): boolean {
  const cleared = new Set<string>();
  const filled = new Set<string>();
  onyxData.forEach(update => {
    if (
      update.key !== ONYXKEYS.CACHED_DRINKING_SESSIONS ||
      update.onyxMethod !== Onyx.METHOD.MERGE ||
      !update.value ||
      typeof update.value !== 'object'
    ) {
      return;
    }
    Object.entries(update.value as Record<string, unknown>).forEach(
      ([uid, entry]) => {
        if (entry === null) {
          cleared.add(uid);
        } else if (entry && typeof entry === 'object') {
          filled.add(uid);
        }
      },
    );
  });
  return [...cleared].some(uid => filled.has(uid));
}

/**
 * The response's onyxData, plus a stamp of the server update a full sessions
 * snapshot was taken at (`SESSIONS_SNAPSHOT_UPDATE_ID`), in the same batch as
 * the snapshot itself. `DrinkingSession.syncLocalLiveSessionData` compares the
 * stamp with the update that acknowledged its own writes, so a snapshot that
 * predates them (one queued ahead of them while offline) cannot roll a live
 * session back or clear it.
 */
function withSnapshotStamp(response: Response): OnyxUpdate[] | undefined {
  const onyxData = response.onyxData;
  if (!onyxData || !isFullSessionsSnapshot(onyxData)) {
    return onyxData;
  }
  const lastUpdateID = getResponseUpdateID(response);
  if (lastUpdateID === undefined) {
    return onyxData;
  }
  return [
    ...onyxData,
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.SESSIONS_SNAPSHOT_UPDATE_ID,
      value: lastUpdateID,
    },
  ];
}

function applyHTTPSOnyxUpdates(request: Request, response: Response) {
  console.debug('[OnyxUpdateManager] Applying https update');
  // For most requests we can immediately update Onyx. For write requests we queue the updates and apply them after the sequential queue has flushed to prevent a replay effect in
  // the UI. See https://github.com/Expensify/App/issues/12775 for more info.
  const updateHandler: (updates: OnyxUpdate[]) => Promise<unknown> =
    request?.data?.apiRequestType === CONST.API_REQUEST_TYPE.WRITE
      ? QueuedOnyxUpdates.queueOnyxUpdates
      : Onyx.update;

  const onyxData = withSnapshotStamp(response);
  const successData = request.successData
    ? resolveResponseTemplates(request.successData, response)
    : undefined;

  // First apply any onyx data updates that are being sent back from the API. We wait for this to complete and then
  // apply successData or failureData. This ensures that we do not update any pending, loading, or other UI states contained
  // in successData/failureData until after the component has received and API data.
  const onyxDataUpdatePromise = onyxData
    ? updateHandler(onyxData)
    : Promise.resolve();
  return onyxDataUpdatePromise
    .then(() => {
      // Handle the request's success/failure data (client-side data)
      if (response.jsonCode === 200 && successData) {
        return updateHandler(successData);
      }
      if (response.jsonCode !== 200 && request.failureData) {
        return updateHandler(request.failureData);
      }
      return Promise.resolve();
    })
    .then(() => {
      if (request.finallyData) {
        return updateHandler(request.finallyData);
      }
      return Promise.resolve();
    })
    .then(() => {
      console.debug('[OnyxUpdateManager] Done applying HTTPS update');
      return Promise.resolve(response);
    });
}

function applyPusherOnyxUpdates(updates: OnyxUpdateEvent[]) {
  pusherEventsPromise = updates
    .reduce(
      (promise, update) =>
        promise.then(() =>
          PusherUtils.triggerMultiEventHandler(update.eventType, update.data),
        ),
      pusherEventsPromise,
    )
    .then(() => {
      console.debug('[OnyxUpdateManager] Done applying Pusher update');
    });

  return pusherEventsPromise;
}

function applyAirshipOnyxUpdates(updates: OnyxUpdateEvent[]) {
  airshipEventsPromise = airshipEventsPromise.then(() => {
    console.debug('[OnyxUpdateManager] Applying Airship updates');
  });

  airshipEventsPromise = updates
    .reduce(
      (promise, update) => promise.then(() => Onyx.update(update.data)),
      airshipEventsPromise,
    )
    .then(() => {
      console.debug('[OnyxUpdateManager] Done applying Airship updates');
    });

  return airshipEventsPromise;
}

/**
 * @param [updateParams.request] Exists if updateParams.type === 'https'
 * @param [updateParams.response] Exists if updateParams.type === 'https'
 * @param [updateParams.updates] Exists if updateParams.type === 'pusher'
 */
function apply({
  lastUpdateID,
  type,
  request,
  response,
  updates,
}: Merge<
  OnyxUpdatesFromServer,
  {updates: OnyxUpdateEvent[]; type: 'pusher'}
>): Promise<void>;
function apply({
  lastUpdateID,
  type,
  request,
  response,
  updates,
}: Merge<
  OnyxUpdatesFromServer,
  {request: Request; response: Response; type: 'https'}
>): Promise<Response>;
function apply({
  lastUpdateID,
  type,
  request,
  response,
  updates,
}: OnyxUpdatesFromServer): Promise<Response>;
function apply({
  lastUpdateID,
  type,
  request,
  response,
  updates,
}: OnyxUpdatesFromServer): Promise<void | Response> | undefined {
  Log.info(
    `[OnyxUpdateManager] Applying update type: ${type} with lastUpdateID: ${lastUpdateID}`,
    false,
    {command: request?.command},
  );

  // OpenApp and a full ReconnectApp (no `updateIDFrom`) return the authoritative
  // snapshot rather than an incremental delta, so their onyxData must be applied
  // even when the response's lastUpdateID is <= the client's applied ID —
  // otherwise a client that advanced its applied ID via incremental Pusher
  // deltas but never received the snapshot is stranded (e.g. an empty
  // `cachedDrinkingSessions`). Mirrors upstream Expensify's `apply`.
  const isUpdateOld =
    lastUpdateID &&
    lastUpdateIDAppliedToClient &&
    Number(lastUpdateID) <= lastUpdateIDAppliedToClient;
  const isOpenAppRequest = request?.command === WRITE_COMMANDS.OPEN_APP;
  const isFullReconnectRequest =
    request?.command === SIDE_EFFECT_REQUEST_COMMANDS.RECONNECT_APP &&
    !request?.data?.updateIDFrom;

  if (isUpdateOld && !isOpenAppRequest && !isFullReconnectRequest) {
    Log.info(
      '[OnyxUpdateManager] Update received was older than or the same as current state, returning without applying the updates other than successData and failureData',
    );

    // In this case, we're already received the OnyxUpdate included in the response, so we don't need to apply it again.
    // However, we do need to apply the successData and failureData from the request
    if (
      type === CONST.ONYX_UPDATE_TYPES.HTTPS &&
      request &&
      response &&
      (!isEmptyObject(request.successData) ||
        !isEmptyObject(request.failureData) ||
        !isEmptyObject(request.finallyData))
    ) {
      Log.info(
        '[OnyxUpdateManager] Applying success or failure data from request without onyxData from response',
      );

      // We use a spread here instead of delete because we don't want to change the response for other middlewares
      const {onyxData, ...responseWithoutOnyxData} = response;
      return applyHTTPSOnyxUpdates(request, responseWithoutOnyxData);
    }

    return Promise.resolve();
  }
  if (
    lastUpdateID &&
    (lastUpdateIDAppliedToClient === undefined ||
      Number(lastUpdateID) > lastUpdateIDAppliedToClient)
  ) {
    Onyx.merge(
      ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
      Number(lastUpdateID),
    );
  }
  if (type === CONST.ONYX_UPDATE_TYPES.HTTPS && request && response) {
    return applyHTTPSOnyxUpdates(request, response);
  }
  if (type === CONST.ONYX_UPDATE_TYPES.PUSHER && updates) {
    return applyPusherOnyxUpdates(updates);
  }
  if (type === CONST.ONYX_UPDATE_TYPES.AIRSHIP && updates) {
    return applyAirshipOnyxUpdates(updates);
  }
}

/**
 * @param [updateParams.request] Exists if updateParams.type === 'https'
 * @param [updateParams.response] Exists if updateParams.type === 'https'
 * @param [updateParams.updates] Exists if updateParams.type === 'pusher'
 */
function saveUpdateInformation(updateParams: OnyxUpdatesFromServer) {
  // If we got here, that means we are missing some updates on our local storage. To
  // guarantee that we're not fetching more updates before our local data is up to date,
  // let's stop the sequential queue from running until we're done catching up.
  SequentialQueue.pause();

  // Always use set() here so that the updateParams are never merged and always unique to the request that came in
  Onyx.set(ONYXKEYS.ONYX_UPDATES_FROM_SERVER, updateParams);
}

/**
 * This function will receive the previousUpdateID from any request/pusher update that has it, compare to our current app state
 * and return if an update is needed
 * @param previousUpdateID The previousUpdateID contained in the response object
 * @param clientLastUpdateID an optional override for the lastUpdateIDAppliedToClient
 */
function doesClientNeedToBeUpdated(
  previousUpdateID = 0,
  clientLastUpdateID = 0,
): boolean {
  // If no previousUpdateID is sent, this is not a WRITE request so we don't need to update our current state
  if (!previousUpdateID) {
    return false;
  }

  const lastUpdateIDFromClient =
    clientLastUpdateID || lastUpdateIDAppliedToClient;

  // If we don't have any value in lastUpdateIDFromClient, this is the first time we're receiving anything, so we need to do a last reconnectApp
  if (!lastUpdateIDFromClient) {
    Log.info('We do not have lastUpdateIDFromClient, client needs updating');
    return true;
  }
  if (lastUpdateIDFromClient < previousUpdateID) {
    Log.info(
      'lastUpdateIDFromClient is less than the previousUpdateID received, client needs updating',
      false,
      {lastUpdateIDFromClient, previousUpdateID},
    );
    return true;
  }

  return false;
}

// eslint-disable-next-line import/prefer-default-export
export {apply, doesClientNeedToBeUpdated, saveUpdateInformation};
