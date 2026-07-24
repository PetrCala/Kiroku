/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views -- this integration test drives the real API.write/SequentialQueue pipeline; it is not a view */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds/asserts Onyx directly to model offline persistence and replay */
/* eslint-disable rulesdir/no-multiple-api-calls -- each API.write models an independent user action in a separate test case */

/**
 * Durability coverage for offline-queued session writes.
 *
 * Drives the REAL write pipeline (API.write -> SequentialQueue ->
 * PersistedRequests -> Request middleware) against real Onyx with only the
 * HTTP layer stubbed, and proves the queue's failure semantics:
 *
 *  - transient failures (network-layer, 5xx) can NEVER permanently drop a
 *    persisted write, no matter how many retries they burn; the request stays
 *    queued and delivers once conditions recover,
 *  - a deterministic 4xx still drops, but the session payload survives it:
 *    a dropped live flush re-arms the debounced persist (capped), and a
 *    dropped finalize is parked in UNSYNCED_SESSION_WRITES and re-sent by
 *    the next app run.
 *
 * Regression guard for the "drink logged offline vanished" bug: flapping
 * between airplane mode and flaky connectivity used to exhaust the throttle's
 * lifetime retry budget and silently delete the queued UpdateSession.
 */
import Onyx from 'react-native-onyx';
import type {OnyxKey} from 'react-native-onyx';
import * as API from '@libs/API';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import HttpsError from '@libs/Errors/HttpsError';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as DS from '@userActions/DrinkingSession';
import * as PersistedRequests from '@userActions/PersistedRequests';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
  DrinkingSession,
  DrinksToUnits,
  OngoingSessionSync,
  UnsyncedSessionWriteList,
} from '@src/types/onyx';

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

// Capture every outbound request; per-test implementations model a healthy
// server, a network-layer failure, or an HTTP error status.
const mockXhr = jest.fn();
jest.mock('@libs/HttpUtils', () => ({
  __esModule: true,
  default: {
    xhr: (command: string, data: Record<string, unknown>): Promise<unknown> =>
      mockXhr(command, data) as Promise<unknown>,
    cancelPendingRequests: jest.fn(),
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

// Failing requests route through the RecheckConnection middleware, which asks
// NetInfo for a connectivity probe; the native module doesn't exist in jest.
jest.mock('@react-native-community/netinfo', () =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);

// generatePushID pulls expo-crypto (ESM), which this jest environment cannot
// transform; the tests here mint their own ids anyway.
jest.mock('@libs/generatePushID', () => ({
  __esModule: true,
  default: () => 'generated-session-id',
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
}));

jest.mock('@libs/Localize', () => ({translateLocal: (key: string) => key}));

jest.setTimeout(30000);

const ME = 'user-1';
const DRINKS_TO_UNITS: DrinksToUnits = {
  small_beer: 1,
  beer: 1,
  cocktail: 1,
  other: 1,
  strong_shot: 1,
  weak_shot: 1,
  wine: 1,
};

// Shrink the retry budget and waits so exhausting them takes milliseconds
// instead of the production ~40-80 seconds.
type MutableNetworkTuning = {
  MAX_REQUEST_RETRIES: number;
  MIN_RETRY_WAIT_TIME_MS: number;
  MAX_RANDOM_RETRY_WAIT_TIME_MS: number;
  MAX_RETRY_WAIT_TIME_MS: number;
};
const networkTuning = CONST.NETWORK as unknown as MutableNetworkTuning;
const originalTuning: MutableNetworkTuning = {
  MAX_REQUEST_RETRIES: networkTuning.MAX_REQUEST_RETRIES,
  MIN_RETRY_WAIT_TIME_MS: networkTuning.MIN_RETRY_WAIT_TIME_MS,
  MAX_RANDOM_RETRY_WAIT_TIME_MS: networkTuning.MAX_RANDOM_RETRY_WAIT_TIME_MS,
  MAX_RETRY_WAIT_TIME_MS: networkTuning.MAX_RETRY_WAIT_TIME_MS,
};
const TEST_MAX_RETRIES = 2;

function okResponse(): Promise<unknown> {
  return Promise.resolve({
    jsonCode: 200,
    onyxData: [],
    lastUpdateID: 0,
    previousUpdateID: 0,
  });
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

/** Poll `predicate` (sync or async) until true or the timeout elapses. */
async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 10000,
): Promise<void> {
  const start = Date.now();
  // eslint-disable-next-line no-await-in-loop
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>(resolve => {
      setTimeout(resolve, 10);
    });
  }
}

// Read a single Onyx key once. Uses Onyx.connect because this node-style action
// test has no React render context for useOnyx().
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

function networkFailure(): Promise<never> {
  // What a dead fetch produces: an error with no HTTP status at all.
  return Promise.reject(new Error('Failed to fetch'));
}

function httpFailure(status: string): Promise<never> {
  return Promise.reject(new HttpsError({message: `HTTP ${status}`, status}));
}

function queuedCommands(): string[] {
  return PersistedRequests.getAll().map(request => request.command);
}

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
  networkTuning.MAX_REQUEST_RETRIES = TEST_MAX_RETRIES;
  networkTuning.MIN_RETRY_WAIT_TIME_MS = 1;
  networkTuning.MAX_RANDOM_RETRY_WAIT_TIME_MS = 2;
  networkTuning.MAX_RETRY_WAIT_TIME_MS = 4;
});

afterAll(() => {
  Object.assign(networkTuning, originalTuning);
});

beforeEach(async () => {
  mockXhr.mockReset();
  mockXhr.mockImplementation(() => okResponse());
  SequentialQueue.resetQueue();
  await Onyx.clear();
  // Resolve NetworkStore readiness (it waits for SESSION + CREDENTIALS).
  await Onyx.multiSet({
    [ONYXKEYS.SESSION]: {authToken: 'tok'},
    [ONYXKEYS.CREDENTIALS]: {},
  });
  await settle();
});

describe('Offline write durability (real write pipeline)', () => {
  it('keeps a queued write through retry exhaustion on network-layer failures, then delivers it', async () => {
    await setNetwork(true);
    const session = DSUtils.getEmptySession({
      id: 'sess-net',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {sessionId: 'sess-net', session, sessionIsLive: false},
      {},
    );
    await settle();
    expect(queuedCommands()).toEqual([WRITE_COMMANDS.UPDATE_SESSION]);
    expect(mockXhr).not.toHaveBeenCalled();

    // Reconnect against a dead network (the app believes it is online, every
    // fetch fails). The retry budget is exhausted...
    mockXhr.mockImplementation(networkFailure);
    await setNetwork(false);
    await waitFor(() => mockXhr.mock.calls.length >= TEST_MAX_RETRIES + 1);
    await settle();

    // ...but the request is NOT dropped, and waitForIdle() is not wedged.
    expect(queuedCommands()).toEqual([WRITE_COMMANDS.UPDATE_SESSION]);
    await SequentialQueue.waitForIdle();

    // The next reconnection delivers it and empties the queue.
    mockXhr.mockImplementation(() => okResponse());
    await setNetwork(true);
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);
  });

  it('keeps a queued write through retry exhaustion on 5xx responses, then delivers it', async () => {
    await setNetwork(true);
    const session = DSUtils.getEmptySession({
      id: 'sess-5xx',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {sessionId: 'sess-5xx', session, sessionIsLive: false},
      {},
    );
    await settle();
    expect(queuedCommands()).toEqual([WRITE_COMMANDS.UPDATE_SESSION]);

    // A server outage (500s) burns the whole retry budget...
    mockXhr.mockImplementation(() => httpFailure('500'));
    await setNetwork(false);
    await waitFor(() => mockXhr.mock.calls.length >= TEST_MAX_RETRIES + 1);
    await settle();

    // ...and still must not destroy the write.
    expect(queuedCommands()).toEqual([WRITE_COMMANDS.UPDATE_SESSION]);

    mockXhr.mockImplementation(() => okResponse());
    await setNetwork(true);
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);
  });

  it('parks a finalize dropped on a deterministic 4xx and re-sends it on the next run', async () => {
    await setNetwork(true);
    const session: DrinkingSession = {
      ...DSUtils.getEmptySession({
        id: 'sess-final',
        type: CONST.SESSION.TYPES.LIVE,
        ongoing: false,
      }),
      drinks: {1000: {beer: 2}},
    };
    await DS.saveDrinkingSessionData(
      ME,
      session,
      'sess-final',
      ONYXKEYS.EDIT_SESSION_DATA,
      false,
    );
    await settle();
    expect(queuedCommands()).toEqual([WRITE_COMMANDS.UPDATE_SESSION]);

    // The server deterministically rejects the payload: the request is
    // dropped, but the full payload is parked instead of lost.
    mockXhr.mockImplementation(() => httpFailure('400'));
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await settle();
    const parked = await readOnyx<UnsyncedSessionWriteList>(
      ONYXKEYS.UNSYNCED_SESSION_WRITES,
    );
    expect(parked?.['sess-final']).toMatchObject({
      sessionId: 'sess-final',
      userID: ME,
      sessionIsLive: false,
    });
    expect(parked?.['sess-final'].session.drinks).toMatchObject({
      1000: {beer: 2},
    });

    // "Next app run" against a healed server: the parked write is
    // re-enqueued, delivered, and the parked entry cleared.
    mockXhr.mockImplementation(() => okResponse());
    const callsBeforeResend = mockXhr.mock.calls.length;
    DS.resendUnsyncedSessionWrites();
    await waitFor(
      () =>
        mockXhr.mock.calls.length > callsBeforeResend &&
        PersistedRequests.getAll().length === 0,
    );
    await settle();
    expect(mockXhr).toHaveBeenLastCalledWith(
      WRITE_COMMANDS.UPDATE_SESSION,
      expect.objectContaining({sessionId: 'sess-final'}),
    );
    const parkedAfter = await readOnyx<UnsyncedSessionWriteList>(
      ONYXKEYS.UNSYNCED_SESSION_WRITES,
    );
    expect(parkedAfter?.['sess-final']).toBeUndefined();
  });

  it('re-arms a dropped live flush up to the cap, keeps the buffer, and recovers on the next edit', async () => {
    const live = DSUtils.getEmptySession({
      id: 'live-1',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: true,
    });
    await Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, live);
    await settle();

    // Log a drink fully offline: the debounced flush queues an UpdateSession
    // and stamps `enqueuedAt`.
    await setNetwork(true);
    DS.updateDrinks(
      'live-1',
      CONST.DRINKS.KEYS.BEER,
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await waitFor(() => PersistedRequests.getAll().length === 1, 5000);
    let sync = await readOnyx<OngoingSessionSync>(
      ONYXKEYS.ONGOING_SESSION_SYNC,
    );
    expect(sync?.sessionId).toBe('live-1');
    expect(sync?.enqueuedAt).toBe(sync?.editedAt);

    // The server deterministically rejects it. Each drop re-arms the persist
    // (failureData clears `enqueuedAt`), until the drop cap stops the loop.
    mockXhr.mockImplementation(() => httpFailure('400'));
    await setNetwork(false);
    await waitFor(async () => {
      const current = await readOnyx<OngoingSessionSync>(
        ONYXKEYS.ONGOING_SESSION_SYNC,
      );
      return current?.flushDropCount === 3;
    }, 20000);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await settle();

    // The re-arm loop stopped: no new request within another debounce window.
    const callsAtCap = mockXhr.mock.calls.length;
    await new Promise<void>(resolve => {
      setTimeout(resolve, 800);
    });
    expect(mockXhr.mock.calls.length).toBe(callsAtCap);
    expect(PersistedRequests.getAll()).toHaveLength(0);

    // The local buffer still holds the drink: nothing was wiped.
    const buffer = await readOnyx<DrinkingSession>(
      ONYXKEYS.ONGOING_SESSION_DATA,
    );
    expect(Object.keys(buffer?.drinks ?? {})).toHaveLength(1);

    // A new edit grants a fresh drop budget; with a healed server the flush
    // now succeeds and `syncedAt` catches up to `editedAt`.
    mockXhr.mockImplementation(() => okResponse());
    DS.updateDrinks(
      'live-1',
      CONST.DRINKS.KEYS.BEER,
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await waitFor(async () => {
      const current = await readOnyx<OngoingSessionSync>(
        ONYXKEYS.ONGOING_SESSION_SYNC,
      );
      return (
        current?.syncedAt !== undefined && current.syncedAt === current.editedAt
      );
    }, 5000);
    sync = await readOnyx<OngoingSessionSync>(ONYXKEYS.ONGOING_SESSION_SYNC);
    expect(sync?.flushDropCount).toBeUndefined();
  });
});
