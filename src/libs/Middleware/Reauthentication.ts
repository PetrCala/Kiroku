import {getKirokuRoute} from '@libs/API/kirokuRoutes';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import Log from '@libs/Log';
import * as NetworkStore from '@libs/Network/NetworkStore';
import NetworkConnection from '@libs/NetworkConnection';
import * as Request from '@libs/Request';
import CONST from '@src/CONST';
import type OnyxRequest from '@src/types/onyx/Request';
import type Middleware from './types';

/**
 * Reauthentication for the kiroku-api transport. kiroku-api authenticates with a
 * Firebase ID token (Bearer); on an expired token it returns `{ jsonCode: 407 }`
 * (NOT_AUTHENTICATED). "Reauthenticate" therefore means force-refreshing the
 * Firebase ID token so the replayed request — which reads `getIdToken()` per
 * call in `HttpUtils` — picks up a fresh one.
 *
 * This is a Kiroku-specific adaptation of Expensify's Reauthentication: it does
 * not use the Expensify credential exchange (`Authentication`) or the deprecated
 * `MainQueue` replay path, neither of which exists here.
 */

// Only one token refresh runs at a time; concurrent 407s share the same promise.
let isReauthenticating: Promise<unknown> | null = null;

// Requests already retried once after a refresh — prevents an infinite reauth
// loop if the server keeps returning 407 (e.g. a revoked/disabled account).
const reauthenticatedRequests = new WeakSet<OnyxRequest>();

function reauthenticate(): Promise<unknown> {
  if (isReauthenticating) {
    return isReauthenticating;
  }

  const user = getFirebaseAuth().currentUser;
  isReauthenticating = (
    user
      ? user.getIdToken(true)
      : Promise.reject(new Error('No authenticated user to reauthenticate'))
  )
    .then(result => {
      isReauthenticating = null;
      return result;
    })
    .catch(error => {
      isReauthenticating = null;
      throw error;
    });

  return isReauthenticating;
}

const Reauthentication: Middleware = (
  response,
  request,
  isFromSequentialQueue,
) =>
  response.then(data => {
    if (!data) {
      Log.hmmm('[Reauthentication] Undefined data in response');
      return data;
    }

    // Public routes have no token to refresh; reauthenticating one would reject
    // (no signed-in user) and surface as a spurious "Failed to reauthenticate".
    // The server won't return 407 for these, but guard defensively regardless.
    if (getKirokuRoute(request.command)?.requiresAuth === false) {
      return data;
    }

    if (data.jsonCode !== CONST.JSON_CODE.NOT_AUTHENTICATED) {
      return data;
    }

    if (NetworkStore.isOffline()) {
      throw new Error('Unable to reauthenticate because we are offline');
    }

    // Already retried once after a refresh — give up rather than loop forever.
    if (reauthenticatedRequests.has(request)) {
      return data;
    }
    reauthenticatedRequests.add(request);

    const apiRequestType = request?.data?.apiRequestType;

    return reauthenticate()
      .then(() => {
        // Queue writes and side-effect requests replay through the full chain
        // (which re-reads a fresh Firebase ID token in HttpUtils).
        if (
          isFromSequentialQueue ||
          apiRequestType ===
            CONST.API_REQUEST_TYPE.MAKE_REQUEST_WITH_SIDE_EFFECTS
        ) {
          return Request.processWithMiddleware(request, isFromSequentialQueue);
        }

        // Reads re-run via the reconnection callbacks (e.g. OpenApp).
        if (apiRequestType === CONST.API_REQUEST_TYPE.READ) {
          NetworkConnection.triggerReconnectionCallbacks(
            'read request made with an expired token',
          );
          return undefined;
        }

        return Request.processWithMiddleware(request, isFromSequentialQueue);
      })
      .catch(() => {
        throw new Error('Failed to reauthenticate');
      });
  });

export default Reauthentication;
