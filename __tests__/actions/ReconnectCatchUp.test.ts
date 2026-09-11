/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds/asserts Onyx directly to model the client's sync state */

/**
 * Reconnect catch-up on the real write pipeline (Reconnect -> App.reconnectApp
 * -> API.write -> SequentialQueue -> middleware -> OnyxUpdates), with only the
 * HTTP layer stubbed.
 *
 * Going offline, missing updates on the server and coming back must fill the
 * gap: the client asks for everything after the last update it applied, the
 * missed updates land in Onyx, and the applied pointer advances.
 */
import Onyx from 'react-native-onyx';
import type {OnyxKey, OnyxUpdate} from 'react-native-onyx';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as PersistedRequests from '@userActions/PersistedRequests';
import * as Reconnect from '@userActions/Reconnect';
import ONYXKEYS from '@src/ONYXKEYS';

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

const mockXhr = jest.fn();
jest.mock('@libs/HttpUtils', () => ({
  __esModule: true,
  default: {
    xhr: (command: string, data: Record<string, unknown>): Promise<unknown> =>
      mockXhr(command, data) as Promise<unknown>,
    cancelPendingRequests: jest.fn(),
  },
}));

// Capture the foreground listener so a test can simulate the app coming back.
let mockBecameActive: (() => void) | undefined;
jest.mock('@libs/AppStateMonitor', () => ({
  __esModule: true,
  default: {
    addBecameActiveListener: (callback: () => void) => {
      mockBecameActive = callback;
      return () => {
        mockBecameActive = undefined;
      };
    },
  },
}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({currentUser: {uid: 'user-1'}}),
}));

// The sequential queue only flushes from the leader client.
jest.mock('@libs/ActiveClientManager', () => ({
  isClientTheLeader: () => true,
  isReady: () => true,
}));

jest.mock('@libs/Pusher/pusher', () => ({getPusherSocketID: () => ''}));

jest.mock('@react-native-community/netinfo', () =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);

// generatePushID pulls expo-crypto (ESM), which this jest environment cannot
// transform.
jest.mock('@libs/generatePushID', () => ({
  __esModule: true,
  default: () => 'generated-id',
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
}));

jest.mock('@libs/Localize', () => ({translateLocal: (key: string) => key}));

jest.setTimeout(30000);

const ME = 'user-1';

// An update another device made while this one was offline.
const MISSED_UPDATE = {
  onyxMethod: Onyx.METHOD.MERGE,
  key: ONYXKEYS.USER_DATA_LIST,
  value: {[ME]: {profile: {display_name: 'Renamed on the watch'}}},
} as OnyxUpdate;

function okResponse(): Promise<unknown> {
  return Promise.resolve({jsonCode: 200, onyxData: []});
}

// Flush microtasks + a few macrotask ticks so real Onyx writes and the
// SequentialQueue settle (jsdom lacks setImmediate, so avoid it).
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0);
    });
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 10000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>(resolve => {
      setTimeout(resolve, 10);
    });
  }
}

function readOnyx<T>(key: OnyxKey): Promise<T | undefined> {
  return new Promise<T | undefined>(resolve => {
    // eslint-disable-next-line rulesdir/no-onyx-connect, rulesdir/prefer-onyx-connect-in-libs -- test-only Onyx read; useOnyx() requires a React render this node test doesn't have
    const connection = Onyx.connect({
      key,
      callback: (value: unknown) => {
        Onyx.disconnect(connection);
        resolve(value as T | undefined);
      },
    });
  });
}

async function setNetwork(isOffline: boolean): Promise<void> {
  await Onyx.merge(ONYXKEYS.NETWORK, {isOffline});
  await settle();
}

/** The data of every ReconnectApp that reached the HTTP layer. */
function reconnectCalls(): Array<Record<string, unknown>> {
  return mockXhr.mock.calls
    .filter(([command]) => command === WRITE_COMMANDS.RECONNECT_APP)
    .map(([, data]: [string, Record<string, unknown>]) => data);
}

/**
 * A server that has updates 6 and 7 the client hasn't seen: a ReconnectApp
 * from update 5 gets them back, stamped with the new baseline.
 */
function serverWithMissedUpdates() {
  mockXhr.mockImplementation((command: string) =>
    command === WRITE_COMMANDS.RECONNECT_APP
      ? Promise.resolve({
          jsonCode: 200,
          onyxData: [MISSED_UPDATE],
          lastUpdateID: 7,
        })
      : okResponse(),
  );
}

let unsubscribe: () => void = () => {};

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
  mockXhr.mockReset();
  mockXhr.mockImplementation(() => okResponse());
  SequentialQueue.resetQueue();
  await Onyx.clear();
  await Onyx.multiSet({
    // Resolve NetworkStore readiness (it waits for SESSION + CREDENTIALS).
    [ONYXKEYS.SESSION]: {authToken: 'tok', userID: ME},
    [ONYXKEYS.CREDENTIALS]: {},
    // A signed-in client whose OpenApp finished and that applied update 5.
    [ONYXKEYS.IS_LOADING_APP]: false,
    [ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT]: 5,
  });
  await settle();
  unsubscribe = Reconnect.subscribeToReconnect();
});

afterEach(() => {
  unsubscribe();
});

describe('Reconnect catch-up (real write pipeline)', () => {
  it('fills the gap missed while offline once connectivity returns', async () => {
    await setNetwork(true);
    serverWithMissedUpdates();

    await setNetwork(false);
    await waitFor(() => reconnectCalls().length === 1);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await settle();

    expect(reconnectCalls().at(0)?.updateIDFrom).toBe(5);
    const userDataList = await readOnyx<Record<string, unknown>>(
      ONYXKEYS.USER_DATA_LIST,
    );
    expect(userDataList).toEqual({
      [ME]: {profile: {display_name: 'Renamed on the watch'}},
    });
    expect(
      await readOnyx<number>(
        ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
      ),
    ).toBe(7);
  });

  it('catches up when the app returns to the foreground', async () => {
    serverWithMissedUpdates();

    mockBecameActive?.();
    await waitFor(() => reconnectCalls().length === 1);
    await settle();

    expect(reconnectCalls().at(0)?.updateIDFrom).toBe(5);
    expect(
      await readOnyx<number>(
        ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
      ),
    ).toBe(7);
  });

  it('collapses a burst of triggers while offline into one catch-up', async () => {
    await setNetwork(true);
    mockBecameActive?.();
    mockBecameActive?.();
    await settle();
    expect(
      PersistedRequests.getAll().filter(
        request => request.command === WRITE_COMMANDS.RECONNECT_APP,
      ),
    ).toHaveLength(1);

    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await settle();
    expect(reconnectCalls()).toHaveLength(1);
  });

  it('does a full reconnect when the client has no baseline yet', async () => {
    await Onyx.set(
      ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
      null,
    );
    await settle();

    mockBecameActive?.();
    await waitFor(() => reconnectCalls().length === 1);

    expect(reconnectCalls().at(0)).not.toHaveProperty('updateIDFrom');
  });

  it('leaves catch-up to OpenApp while the app is still loading', async () => {
    await Onyx.set(ONYXKEYS.IS_LOADING_APP, true);
    await settle();

    mockBecameActive?.();
    await setNetwork(true);
    await setNetwork(false);
    await settle();

    expect(reconnectCalls()).toHaveLength(0);
  });

  it('stops catching up after sign-out', async () => {
    unsubscribe();
    await setNetwork(true);
    await setNetwork(false);
    await settle();

    expect(reconnectCalls()).toHaveLength(0);
  });
});
