import Onyx from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
// import {
//   READ_COMMANDS,
//   SIDE_EFFECT_REQUEST_COMMANDS,
//   WRITE_COMMANDS,
// } from '@libs/API/types';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type Credentials from '@src/types/onyx/Credentials';

let credentials: Credentials | null | undefined;
let authToken: string | null | undefined;
let authTokenType: ValueOf<typeof CONST.AUTH_TOKEN_TYPES> | null;
let currentUserEmail: string | null = null;
let offline = false;
// Whether we've ever received an authoritative connectivity signal. A fresh
// launch starts in the default (online) state, so an offline->online edge never
// fires on boot — and `NetworkConnection.subscribeToNetInfo`, which would
// otherwise kick the initial queue flush, is intentionally disabled (the NetInfo
// bridge is the sole NETWORK-key writer). Tracking this lets us treat the first
// online signal as a reconnection so writes persisted during a prior offline
// session replay after an app reload.
let hasConfirmedConnectivity = false;
let authenticating = false;

// Code outside the network layer listens for reconnection to run side-effects:
// the sequential queue flushes, and the reconnect catch-up fetches what was
// missed (see actions/Reconnect). Callbacks run in registration order, so the
// queue (registered at import) flushes before a catch-up request is queued.
const reconnectCallbacks = new Set<() => void>();
function triggerReconnectCallback() {
  reconnectCallbacks.forEach(callback => callback());
}

/**
 * Run `callbackFunction` whenever connectivity resumes.
 * @returns a function that removes the callback
 */
function onReconnection(callbackFunction: () => void): () => void {
  reconnectCallbacks.add(callbackFunction);
  return () => {
    reconnectCallbacks.delete(callbackFunction);
  };
}

let resolveIsReadyPromise: (args?: unknown[]) => void;
let isReadyPromise = new Promise(resolve => {
  resolveIsReadyPromise = resolve;
});

/**
 * This is a hack to workaround the fact that Onyx may not yet have read these values from storage by the time Network starts processing requests.
 * If the values are undefined we haven't read them yet. If they are null or have a value then we have and the network is "ready".
 */
function checkRequiredData() {
  if (authToken === undefined || credentials === undefined) {
    return;
  }

  resolveIsReadyPromise();
}

function resetHasReadRequiredDataFromStorage() {
  // Create a new promise and a new resolve function
  isReadyPromise = new Promise(resolve => {
    resolveIsReadyPromise = resolve;
  });
}

Onyx.connect({
  key: ONYXKEYS.SESSION,
  callback: val => {
    authToken = val?.authToken ?? null;
    authTokenType = val?.authTokenType ?? null;
    currentUserEmail = val?.email ?? null;
    checkRequiredData();
  },
});

Onyx.connect({
  key: ONYXKEYS.CREDENTIALS,
  callback: val => {
    credentials = val ?? null;
    checkRequiredData();
  },
});

// We subscribe to the online/offline status of the network to determine when we should fire off API calls
// vs queueing them for later.
Onyx.connect({
  key: ONYXKEYS.NETWORK,
  callback: network => {
    if (!network) {
      return;
    }

    const isNowOffline = !!network.shouldForceOffline || !!network.isOffline;
    const isReconnection =
      !isNowOffline && (offline || !hasConfirmedConnectivity);

    // Update the state BEFORE emitting, so a callback that queues a write (the
    // reconnect catch-up) sees the client as online and gets it flushed.
    // Emitting first left such a write parked until the next flush trigger.
    hasConfirmedConnectivity = true;
    offline = isNowOffline;

    // Emit the connectivity-resumed event (which flushes the sequential queue)
    // both on a normal offline->online transition and on the first authoritative
    // online signal after launch. The latter is what replays writes persisted
    // during a prior offline session once the app is reloaded back online.
    if (isReconnection) {
      triggerReconnectCallback();
    }
  },
});

function getCredentials(): Credentials | null | undefined {
  return credentials;
}

function isOffline(): boolean {
  return offline;
}

function getAuthToken(): string | null | undefined {
  return authToken;
}

function isSupportAuthToken(): boolean {
  return authTokenType === CONST.AUTH_TOKEN_TYPES.SUPPORT;
}

function setAuthToken(newAuthToken: string | null) {
  authToken = newAuthToken;
}

function getCurrentUserEmail(): string | null {
  return currentUserEmail;
}

function hasReadRequiredDataFromStorage(): Promise<unknown> {
  return isReadyPromise;
}

function isAuthenticating(): boolean {
  return authenticating;
}

function setIsAuthenticating(val: boolean) {
  authenticating = val;
}

export {
  getAuthToken,
  setAuthToken,
  getCurrentUserEmail,
  hasReadRequiredDataFromStorage,
  resetHasReadRequiredDataFromStorage,
  isOffline,
  onReconnection,
  isAuthenticating,
  setIsAuthenticating,
  getCredentials,
  checkRequiredData,
  isSupportAuthToken,
};
