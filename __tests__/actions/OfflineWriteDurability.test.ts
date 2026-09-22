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
 *  - a deterministic 4xx drops at once (retryable 408 / 425 / 429 don't),
 *    and the session payload survives it:
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
  Request,
  SessionWriteAckList,
  UnsyncedSessionWriteList,
  UserDrinkingSessionsList,
} from '@src/types/onyx';
import type {User} from 'firebase/auth';

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
  LIVE_FLUSH_DROP_COOLDOWN_MS: number;
  LIVE_FLUSH_DROP_COOLDOWN_MAX_MS: number;
};
const networkTuning = CONST.NETWORK as unknown as MutableNetworkTuning;
const originalTuning: MutableNetworkTuning = {
  MAX_REQUEST_RETRIES: networkTuning.MAX_REQUEST_RETRIES,
  MIN_RETRY_WAIT_TIME_MS: networkTuning.MIN_RETRY_WAIT_TIME_MS,
  MAX_RANDOM_RETRY_WAIT_TIME_MS: networkTuning.MAX_RANDOM_RETRY_WAIT_TIME_MS,
  MAX_RETRY_WAIT_TIME_MS: networkTuning.MAX_RETRY_WAIT_TIME_MS,
  LIVE_FLUSH_DROP_COOLDOWN_MS: networkTuning.LIVE_FLUSH_DROP_COOLDOWN_MS,
  LIVE_FLUSH_DROP_COOLDOWN_MAX_MS:
    networkTuning.LIVE_FLUSH_DROP_COOLDOWN_MAX_MS,
};
// The slow re-arm after the live-flush drop cap: 300 ms doubling to 1.2 s in
// tests instead of 30 s doubling to 5 min.
const TEST_FLUSH_COOLDOWN_MS = 300;
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
  networkTuning.LIVE_FLUSH_DROP_COOLDOWN_MS = TEST_FLUSH_COOLDOWN_MS;
  networkTuning.LIVE_FLUSH_DROP_COOLDOWN_MAX_MS = TEST_FLUSH_COOLDOWN_MS * 4;
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

  it.each(['408', '425', '429'])(
    'keeps a queued write through retry exhaustion on a retryable %s, then delivers it',
    async status => {
      await setNetwork(true);
      const sessionId = `sess-${status}`;
      const session = DSUtils.getEmptySession({
        id: sessionId,
        type: CONST.SESSION.TYPES.LIVE,
        ongoing: false,
      });
      API.write(
        WRITE_COMMANDS.UPDATE_SESSION,
        {sessionId, session, sessionIsLive: false},
        {},
      );
      await settle();

      // A timeout, a "too early" or throttling burns the whole retry budget...
      mockXhr.mockImplementation(() => httpFailure(status));
      await setNetwork(false);
      await waitFor(() => mockXhr.mock.calls.length >= TEST_MAX_RETRIES + 1);
      await settle();

      // ...and, being transient, must not drop the write.
      expect(queuedCommands()).toEqual([WRITE_COMMANDS.UPDATE_SESSION]);

      mockXhr.mockImplementation(() => okResponse());
      await setNetwork(true);
      await setNetwork(false);
      await waitFor(() => PersistedRequests.getAll().length === 0);
    },
  );

  it('drops a deterministic 4xx after one attempt, rolls it back, and sends the write behind it', async () => {
    await setNetwork(true);
    const rejected = DSUtils.getEmptySession({
      id: 'sess-rejected',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    const next = DSUtils.getEmptySession({
      id: 'sess-next',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {sessionId: 'sess-rejected', session: rejected, sessionIsLive: false},
      {
        failureData: [
          {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.EDIT_SESSION_DATA,
            value: {note: 'rolled back'},
          },
        ],
      },
    );
    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {sessionId: 'sess-next', session: next, sessionIsLive: false},
      {},
    );
    await settle();
    expect(queuedCommands()).toHaveLength(2);

    // The server rejects the first payload outright and accepts the second.
    mockXhr.mockImplementation(
      (_command: string, data: Record<string, unknown>) =>
        data.sessionId === 'sess-rejected' ? httpFailure('422') : okResponse(),
    );
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await settle();

    // Sent once, never retried, and the write behind it went straight out.
    const sentSessionIds = mockXhr.mock.calls.map(
      ([, data]) => (data as Record<string, unknown>).sessionId,
    );
    expect(sentSessionIds).toEqual(['sess-rejected', 'sess-next']);
    const edit = await readOnyx<DrinkingSession>(ONYXKEYS.EDIT_SESSION_DATA);
    expect(edit?.note).toBe('rolled back');
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

  it('re-arms a dropped live flush at full speed up to the cap, then only per cooldown, keeps the buffer, and recovers on the next edit', async () => {
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
    // (failureData clears `enqueuedAt`), until the drop cap slows the loop.
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

    // The re-arm loop slowed down: nothing goes out inside the cooldown, then
    // exactly one more flush, which is rejected too and doubles the cooldown.
    const callsAtCap = mockXhr.mock.calls.length;
    await new Promise<void>(resolve => {
      setTimeout(resolve, TEST_FLUSH_COOLDOWN_MS / 3);
    });
    expect(mockXhr.mock.calls.length).toBe(callsAtCap);
    expect(PersistedRequests.getAll()).toHaveLength(0);
    await waitFor(() => mockXhr.mock.calls.length === callsAtCap + 1, 3000);
    await waitFor(async () => {
      const current = await readOnyx<OngoingSessionSync>(
        ONYXKEYS.ONGOING_SESSION_SYNC,
      );
      return current?.flushDropCount === 4;
    }, 3000);
    await new Promise<void>(resolve => {
      setTimeout(resolve, TEST_FLUSH_COOLDOWN_MS);
    });
    expect(mockXhr.mock.calls.length).toBe(callsAtCap + 1);

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

  it.each(['400', '401', '403', '404', '409', '413', '422'])(
    'sends a write exactly once on a deterministic %s and clears the retry state',
    async status => {
      await setNetwork(true);
      const sessionId = `sess-drop-${status}`;
      const session = DSUtils.getEmptySession({
        id: sessionId,
        type: CONST.SESSION.TYPES.LIVE,
        ongoing: false,
      });
      API.write(
        WRITE_COMMANDS.UPDATE_SESSION,
        {sessionId, session, sessionIsLive: false},
        {},
      );
      await settle();

      mockXhr.mockImplementation(() => httpFailure(status));
      await setNetwork(false);
      await waitFor(() => PersistedRequests.getAll().length === 0);
      await SequentialQueue.waitForIdle();
      // Give a would-be retry every chance to fire before asserting.
      await new Promise<void>(resolve => {
        setTimeout(resolve, 50);
      });

      expect(mockXhr).toHaveBeenCalledTimes(1);
      // The drop cleared the throttle: no armed timer, no leftover wait.
      expect(
        SequentialQueue.sequentialQueueRequestThrottle.getLastRequestWaitTime(),
      ).toBe(0);
      expect(PersistedRequests.getOngoingRequest()).toBeNull();
      expect(await readOnyx<unknown[]>(ONYXKEYS.PERSISTED_REQUESTS)).toEqual(
        [],
      );
    },
  );

  it('drops a deterministic 4xx that lands on a retry attempt, without a leftover rolled-back copy or a second rollback', async () => {
    await setNetwork(true);
    const session = DSUtils.getEmptySession({
      id: 'sess-late-reject',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    const behind = DSUtils.getEmptySession({
      id: 'sess-behind',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {sessionId: 'sess-late-reject', session, sessionIsLive: false},
      {
        failureData: [
          {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.EDIT_SESSION_DATA,
            value: {note: 'rolled back late'},
          },
        ],
      },
    );
    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {sessionId: 'sess-behind', session: behind, sessionIsLive: false},
      {},
    );
    await settle();

    // Two transient failures first (the request is rolled back into the queue
    // with `isRollbacked` each time), then the server rejects it for good.
    const updateSpy = jest.spyOn(Onyx, 'update');
    let attempts = 0;
    mockXhr.mockImplementation(
      (_command: string, data: Record<string, unknown>) => {
        if (data.sessionId !== 'sess-late-reject') {
          return okResponse();
        }
        attempts += 1;
        return attempts <= 2 ? httpFailure('503') : httpFailure('422');
      },
    );
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await SequentialQueue.waitForIdle();
    await settle();

    const sentSessionIds = mockXhr.mock.calls.map(
      ([, data]) => (data as Record<string, unknown>).sessionId,
    );
    expect(sentSessionIds).toEqual([
      'sess-late-reject',
      'sess-late-reject',
      'sess-late-reject',
      'sess-behind',
    ]);
    // The rolled-back copy was removed along with the request: nothing is
    // left in memory, on disk, or in the ongoing slot.
    expect(PersistedRequests.getAll()).toEqual([]);
    expect(PersistedRequests.getOngoingRequest()).toBeNull();
    expect(await readOnyx<unknown[]>(ONYXKEYS.PERSISTED_REQUESTS)).toEqual([]);
    // Onyx hands a cleared key back as null or undefined depending on the
    // cache state; either means the ongoing slot is empty.
    expect(
      (await readOnyx<unknown>(ONYXKEYS.PERSISTED_ONGOING_REQUESTS)) ?? null,
    ).toBeNull();
    // Failure data ran exactly once, and only for the rejected write.
    const rollbackApplications = updateSpy.mock.calls.filter(([updates]) =>
      JSON.stringify(updates).includes('rolled back late'),
    );
    expect(rollbackApplications).toHaveLength(1);
    updateSpy.mockRestore();
  });

  it('sends a write pushed while the rejected request is in flight right after the drop, and settles waitForIdle', async () => {
    await setNetwork(true);
    const inFlight = DSUtils.getEmptySession({
      id: 'sess-inflight',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    const pushedLater = DSUtils.getEmptySession({
      id: 'sess-pushed-later',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {sessionId: 'sess-inflight', session: inFlight, sessionIsLive: false},
      {},
    );
    await settle();

    // Hold the first request open so a second write can be pushed while the
    // queue is running.
    let rejectInFlight: ((error: unknown) => void) | undefined;
    mockXhr.mockImplementation(
      (_command: string, data: Record<string, unknown>) =>
        data.sessionId === 'sess-inflight'
          ? new Promise<never>((_resolve, reject) => {
              rejectInFlight = reject;
            })
          : okResponse(),
    );
    await setNetwork(false);
    await waitFor(() => rejectInFlight !== undefined);
    expect(SequentialQueue.isRunning()).toBe(true);

    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {
        sessionId: 'sess-pushed-later',
        session: pushedLater,
        sessionIsLive: false,
      },
      {},
    );
    await settle();
    expect(queuedCommands()).toEqual([WRITE_COMMANDS.UPDATE_SESSION]);
    expect(mockXhr).toHaveBeenCalledTimes(1);

    rejectInFlight?.(new HttpsError({message: 'HTTP 422', status: '422'}));
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await SequentialQueue.waitForIdle();
    await settle();

    const sentSessionIds = mockXhr.mock.calls.map(
      ([, data]) => (data as Record<string, unknown>).sessionId,
    );
    expect(sentSessionIds).toEqual(['sess-inflight', 'sess-pushed-later']);
    expect(SequentialQueue.isRunning()).toBe(false);
    expect(PersistedRequests.getOngoingRequest()).toBeNull();
  });

  it('clears the persisted ongoing slot when a persistWhenOngoing request is dropped', async () => {
    await setNetwork(true);
    const session = DSUtils.getEmptySession({
      id: 'sess-ongoing-slot',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: false,
    });
    const request: Request = {
      command: WRITE_COMMANDS.UPDATE_SESSION,
      data: {
        sessionId: 'sess-ongoing-slot',
        session,
        sessionIsLive: false,
        apiRequestType: CONST.API_REQUEST_TYPE.WRITE,
      },
      persistWhenOngoing: true,
      failureData: [
        {
          onyxMethod: Onyx.METHOD.MERGE,
          key: ONYXKEYS.EDIT_SESSION_DATA,
          value: {note: 'ongoing slot rolled back'},
        },
      ],
    };
    SequentialQueue.push(request);
    await settle();
    expect(queuedCommands()).toEqual([WRITE_COMMANDS.UPDATE_SESSION]);

    let rejectInFlight: ((error: unknown) => void) | undefined;
    mockXhr.mockImplementation(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectInFlight = reject;
        }),
    );
    await setNetwork(false);
    await waitFor(() => rejectInFlight !== undefined);
    await settle();
    // While in flight the request lives in the ongoing slot, on disk too.
    expect(
      await readOnyx<Request>(ONYXKEYS.PERSISTED_ONGOING_REQUESTS),
    ).toMatchObject({command: WRITE_COMMANDS.UPDATE_SESSION});

    rejectInFlight?.(new HttpsError({message: 'HTTP 403', status: '403'}));
    await waitFor(
      async () =>
        (await readOnyx<Request>(ONYXKEYS.PERSISTED_ONGOING_REQUESTS)) == null,
    );
    await SequentialQueue.waitForIdle();
    expect(PersistedRequests.getAll()).toEqual([]);
    expect(await readOnyx<unknown[]>(ONYXKEYS.PERSISTED_REQUESTS)).toEqual([]);
    const edit = await readOnyx<DrinkingSession>(ONYXKEYS.EDIT_SESSION_DATA);
    expect(edit?.note).toBe('ongoing slot rolled back');
  });

  it('re-sends the live buffer on the cooldown once the server heals, with no new edit, and the finalize still delivers every drink', async () => {
    const live = DSUtils.getEmptySession({
      id: 'live-cap',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: true,
    });
    await Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, live);
    await settle();
    await setNetwork(true);
    DS.updateDrinks(
      'live-cap',
      CONST.DRINKS.KEYS.BEER,
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await waitFor(() => PersistedRequests.getAll().length === 1, 5000);

    // Three rejections in a row exhaust the automatic re-arm.
    mockXhr.mockImplementation(() => httpFailure('422'));
    await setNetwork(false);
    await waitFor(async () => {
      const current = await readOnyx<OngoingSessionSync>(
        ONYXKEYS.ONGOING_SESSION_SYNC,
      );
      return current?.flushDropCount === 3;
    }, 20000);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await settle();
    const flushesSent = mockXhr.mock.calls.length;

    // The server heals: the slow re-arm re-sends the buffer by itself, and
    // `syncedAt` catches up without the user touching anything.
    mockXhr.mockImplementation(() => okResponse());
    await waitFor(async () => {
      const current = await readOnyx<OngoingSessionSync>(
        ONYXKEYS.ONGOING_SESSION_SYNC,
      );
      return (
        current?.syncedAt !== undefined && current.syncedAt === current.editedAt
      );
    }, 5000);
    let sync = await readOnyx<OngoingSessionSync>(
      ONYXKEYS.ONGOING_SESSION_SYNC,
    );
    expect(mockXhr.mock.calls.length).toBeGreaterThan(flushesSent);
    const flushesAfterHeal = mockXhr.mock.calls.length;

    // The finalize carries the full buffer, so the drink still reaches the
    // server and nothing is parked.
    const buffer = await readOnyx<DrinkingSession>(
      ONYXKEYS.ONGOING_SESSION_DATA,
    );
    expect(Object.keys(buffer?.drinks ?? {})).toHaveLength(1);
    if (!buffer) {
      throw new Error('the live buffer should still hold the session');
    }
    await DS.saveDrinkingSessionData(
      ME,
      {...buffer, ongoing: false},
      'live-cap',
      ONYXKEYS.ONGOING_SESSION_DATA,
      true,
    );
    await waitFor(
      () =>
        mockXhr.mock.calls.length > flushesAfterHeal &&
        PersistedRequests.getAll().length === 0,
    );
    await settle();
    const [, finalizeData] = mockXhr.mock.calls.at(-1) as [
      string,
      Record<string, unknown>,
    ];
    expect(finalizeData.sessionId).toBe('live-cap');
    expect(
      Object.keys((finalizeData.session as DrinkingSession).drinks ?? {}),
    ).toHaveLength(1);
    const parked = await readOnyx<UnsyncedSessionWriteList>(
      ONYXKEYS.UNSYNCED_SESSION_WRITES,
    );
    expect(parked?.['live-cap']).toBeUndefined();
    sync = await readOnyx<OngoingSessionSync>(ONYXKEYS.ONGOING_SESSION_SYNC);
    expect(sync).toBeUndefined();
  });

  it('leaves no stale sync marker when a live flush queued offline delivers after the finalize cleared the stamps', async () => {
    const live = DSUtils.getEmptySession({
      id: 'live-behind',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: true,
    });
    await Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, live);
    await settle();
    await setNetwork(true);
    DS.updateDrinks(
      'live-behind',
      CONST.DRINKS.KEYS.BEER,
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await waitFor(() => PersistedRequests.getAll().length === 1, 5000);

    // The user finishes the session while still offline: the finalize queues
    // behind the live flush, and the sync stamps are cleared at once.
    const buffer = await readOnyx<DrinkingSession>(
      ONYXKEYS.ONGOING_SESSION_DATA,
    );
    if (!buffer) {
      throw new Error('the live buffer should still hold the session');
    }
    await DS.saveDrinkingSessionData(
      ME,
      {...buffer, ongoing: false},
      'live-behind',
      ONYXKEYS.ONGOING_SESSION_DATA,
      true,
    );
    await settle();
    expect(queuedCommands()).toEqual([
      WRITE_COMMANDS.UPDATE_SESSION,
      WRITE_COMMANDS.UPDATE_SESSION,
    ]);
    expect(
      await readOnyx<OngoingSessionSync>(ONYXKEYS.ONGOING_SESSION_SYNC),
    ).toBeUndefined();

    // Back online, both deliver in order. The flush's success data (its
    // `syncedAt` stamp) is applied only after the finalize cleared the stamps
    // and must not leave behind a marker that names no session.
    await setNetwork(false);
    await waitFor(
      () =>
        mockXhr.mock.calls.length === 2 &&
        PersistedRequests.getAll().length === 0,
    );
    await settle();
    const [[, flushData], [, finalizeData]] = mockXhr.mock.calls as Array<
      [string, Record<string, unknown>]
    >;
    expect((flushData.session as DrinkingSession).ongoing).toBe(true);
    expect((finalizeData.session as DrinkingSession).ongoing).toBe(false);
    expect(
      Object.keys((finalizeData.session as DrinkingSession).drinks ?? {}),
    ).toHaveLength(1);
    const sync = await readOnyx<OngoingSessionSync>(
      ONYXKEYS.ONGOING_SESSION_SYNC,
    );
    expect(sync).toBeUndefined();
  });
});

/**
 * The 22 Sep 2026 incident. The app was launched offline, so `app/open` sat in
 * the persisted queue ahead of the live session's create and flushes. On
 * reconnection it was sent first, its snapshot lacked the session, and it was
 * applied in the same drain as the flushes' acknowledgements: the buffer read
 * as synced, the snapshot as authoritative, and the live session was cleared
 * while the server still held it as ongoing.
 */
describe('a full snapshot queued ahead of an offline live session', () => {
  const SESSION_ID = 'generated-session-id';
  const STALE_SNAPSHOT_UPDATE_ID = 100;

  /** The open answers with the world as it stood before the session's writes. */
  function serverWithStaleOpen(): void {
    let lastUpdateID = STALE_SNAPSHOT_UPDATE_ID;
    mockXhr.mockImplementation((command: string) => {
      if (command === WRITE_COMMANDS.OPEN_APP) {
        return Promise.resolve({
          jsonCode: 200,
          lastUpdateID: STALE_SNAPSHOT_UPDATE_ID,
          onyxData: [
            {
              onyxMethod: Onyx.METHOD.MERGE,
              key: ONYXKEYS.CACHED_DRINKING_SESSIONS,
              value: {[ME]: null},
            },
            {
              onyxMethod: Onyx.METHOD.MERGE,
              key: ONYXKEYS.CACHED_DRINKING_SESSIONS,
              value: {[ME]: {}},
            },
          ],
        });
      }
      lastUpdateID += 1;
      return Promise.resolve({jsonCode: 200, onyxData: [], lastUpdateID});
    });
  }

  async function startOfflineSessionBehindAnOpen(): Promise<void> {
    await setNetwork(true);
    // Launched offline: the open is queued before the session exists.
    API.write(WRITE_COMMANDS.OPEN_APP, {enablePriorityModeFilter: true});
    await DS.startLiveDrinkingSession({uid: ME} as User, 'Europe/Prague');
    DS.updateDrinks(
      SESSION_ID,
      CONST.DRINKS.KEYS.BEER,
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await waitFor(() => PersistedRequests.getAll().length === 3, 5000);
    expect(queuedCommands()).toEqual([
      WRITE_COMMANDS.OPEN_APP,
      WRITE_COMMANDS.UPDATE_SESSION,
      WRITE_COMMANDS.UPDATE_SESSION,
    ]);
  }

  /** What Home does when the snapshot changes. */
  async function syncFromSnapshot(): Promise<void> {
    const snapshot = await readOnyx<UserDrinkingSessionsList>(
      ONYXKEYS.CACHED_DRINKING_SESSIONS,
    );
    const snapshotUpdateID = await readOnyx<number>(
      ONYXKEYS.SESSIONS_SNAPSHOT_UPDATE_ID,
    );
    await DS.syncLocalLiveSessionData(snapshot?.[ME], snapshotUpdateID);
    await settle();
  }

  it('cannot clear the live buffer: the snapshot predates the writes it lacks', async () => {
    await startOfflineSessionBehindAnOpen();
    serverWithStaleOpen();

    await setNetwork(false);
    await waitFor(
      () =>
        mockXhr.mock.calls.length === 3 &&
        PersistedRequests.getAll().length === 0,
    );
    await settle();

    // The stale open replaced the snapshot (the session is gone from it) and
    // was stamped with its age; the create and the flush were acknowledged
    // by later updates.
    const snapshot = await readOnyx<UserDrinkingSessionsList>(
      ONYXKEYS.CACHED_DRINKING_SESSIONS,
    );
    expect(snapshot?.[ME]?.[SESSION_ID]).toBeUndefined();
    expect(await readOnyx<number>(ONYXKEYS.SESSIONS_SNAPSHOT_UPDATE_ID)).toBe(
      STALE_SNAPSHOT_UPDATE_ID,
    );
    expect(
      (await readOnyx<SessionWriteAckList>(ONYXKEYS.SESSION_WRITE_ACKS))?.[
        SESSION_ID
      ],
    ).toBe(STALE_SNAPSHOT_UPDATE_ID + 2);

    await syncFromSnapshot();

    const buffer = await readOnyx<DrinkingSession>(
      ONYXKEYS.ONGOING_SESSION_DATA,
    );
    expect(buffer?.id).toBe(SESSION_ID);
    expect(buffer?.ongoing).toBe(true);
    expect(Object.keys(buffer?.drinks ?? {})).toHaveLength(1);
  });

  it('still clears the buffer for a snapshot taken after the writes that no longer lists the session', async () => {
    await startOfflineSessionBehindAnOpen();
    serverWithStaleOpen();
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    await settle();

    // A later full snapshot (finished or discarded on another device).
    await Onyx.multiSet({
      [ONYXKEYS.CACHED_DRINKING_SESSIONS]: {[ME]: {}},
      [ONYXKEYS.SESSIONS_SNAPSHOT_UPDATE_ID]: STALE_SNAPSHOT_UPDATE_ID + 5,
    });
    await syncFromSnapshot();

    expect(
      await readOnyx<DrinkingSession>(ONYXKEYS.ONGOING_SESSION_DATA),
    ).toBeUndefined();
  });
});
