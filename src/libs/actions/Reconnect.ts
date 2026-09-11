import type {OnyxEntry} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import AppStateMonitor from '@libs/AppStateMonitor';
import Log from '@libs/Log';
import * as NetworkStore from '@libs/Network/NetworkStore';
import NetworkConnection from '@libs/NetworkConnection';
import ONYXKEYS from '@src/ONYXKEYS';
import * as App from './App';

// Module state read by `catchUp`, which runs outside any React tree.
let lastUpdateIDAppliedToClient: OnyxEntry<number>;
Onyx.connectWithoutView({
  key: ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
  callback: value => {
    lastUpdateIDAppliedToClient = value;
  },
});

let isLoadingApp: OnyxEntry<boolean>;
Onyx.connectWithoutView({
  key: ONYXKEYS.IS_LOADING_APP,
  callback: value => {
    isLoadingApp = value;
  },
});

/**
 * Fetch whatever the client missed while it was offline or in the background.
 *
 * `ReconnectApp` carries the last update this client applied, so the server
 * replays only the missed updates from its update log (or answers with the
 * full payload when the gap is too wide). It is a queued write with a conflict
 * resolver, so a burst of triggers collapses into one request, and it runs
 * after any writes that were queued while offline.
 *
 * While OpenApp is still loading, it is skipped: the pending OpenApp brings the
 * full state anyway.
 */
function catchUp(reason: string) {
  if (isLoadingApp) {
    Log.info(
      `[Reconnect] Skipping catch-up (${reason}): OpenApp is still loading`,
    );
    return;
  }
  Log.info(
    `[Reconnect] Catching up (${reason}) from update ${lastUpdateIDAppliedToClient ?? 'none'}`,
  );
  App.reconnectApp(lastUpdateIDAppliedToClient);
}

/**
 * Catch up whenever the client may have missed updates: connectivity resumed,
 * the realtime connection or auth came back, or the app returned to the
 * foreground (Pusher doesn't deliver while backgrounded). Call it once the
 * user is signed in; the returned function stops it (on sign-out).
 */
function subscribeToReconnect(): () => void {
  const unsubscribers = [
    NetworkStore.onReconnection(() => catchUp('connectivity resumed')),
    NetworkConnection.onReconnect(() =>
      catchUp('realtime or auth reconnected'),
    ),
    AppStateMonitor.addBecameActiveListener(() =>
      catchUp('app returned to the foreground'),
    ),
  ];
  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
}

// eslint-disable-next-line import/prefer-default-export
export {subscribeToReconnect};
