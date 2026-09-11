/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views -- this integration test drives the real API.write/SequentialQueue pipeline; it is not a view */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds/asserts Onyx directly to model persistence across a restart */
/* eslint-disable rulesdir/no-multiple-api-calls -- each API.write models an independent user action */

/**
 * Idempotency keys on the real write pipeline (API.write -> SequentialQueue ->
 * PersistedRequests -> Request middleware), with only the HTTP layer stubbed.
 *
 * The queue replays a write whenever it can't tell whether the server saw it:
 * a lost answer, a timeout, an app restart while the request was in flight.
 * These tests prove the client half of the contract, that a write keeps ONE
 * key through all of that, and, against a fake server that dedupes by key the
 * way kiroku-api does, that a replayed write is applied once.
 */
import Onyx from 'react-native-onyx';
import type {OnyxKey} from 'react-native-onyx';
import * as API from '@libs/API';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as PersistedRequests from '@userActions/PersistedRequests';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Request} from '@src/types/onyx';

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
  default: () => 'generated-session-id',
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
}));

jest.mock('@libs/Localize', () => ({translateLocal: (key: string) => key}));

jest.setTimeout(30000);

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

function networkFailure(): Promise<never> {
  return Promise.reject(new Error('Failed to fetch'));
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

function writeSession(sessionId: string): void {
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
}

/** The idempotency key of every request that reached the HTTP layer. */
function sentKeys(): unknown[] {
  return mockXhr.mock.calls.map(
    ([, data]: [string, Record<string, unknown>]) => data.idempotencyKey,
  );
}

/**
 * Model a cold start: the in-memory queue is gone and only what Onyx wrote to
 * disk comes back.
 */
async function restartWith(persisted: Request[]): Promise<void> {
  SequentialQueue.resetQueue();
  await Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, []);
  await Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, persisted);
  await settle();
}

/**
 * A fake kiroku-api that dedupes by key: the first request with a key is
 * applied, and a repeat is answered from the record. While `answersToLose` is
 * above zero, each answer is dropped after the write was applied, like a
 * response lost on a flaky network.
 */
function fakeServer() {
  const appliedKeys = new Set<string>();
  const state = {applications: 0, answersToLose: 0};
  mockXhr.mockImplementation(
    (_command: string, data: Record<string, unknown>) => {
      const key = data.idempotencyKey as string;
      if (!appliedKeys.has(key)) {
        appliedKeys.add(key);
        state.applications += 1;
      }
      if (state.answersToLose > 0) {
        state.answersToLose -= 1;
        return networkFailure();
      }
      return okResponse();
    },
  );
  return state;
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

describe('Idempotency keys on queued writes (real write pipeline)', () => {
  it('sends one key per write and reuses it on every retry', async () => {
    await setNetwork(true);
    writeSession('sess-retry');
    await settle();

    // Every attempt but the last fails at the network layer.
    let attempts = 0;
    mockXhr.mockImplementation(() => {
      attempts += 1;
      return attempts <= TEST_MAX_RETRIES ? networkFailure() : okResponse();
    });
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);

    const keys = sentKeys();
    expect(keys).toHaveLength(TEST_MAX_RETRIES + 1);
    expect(new Set(keys).size).toBe(1);
    expect(keys.at(0)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('gives separate writes separate keys', async () => {
    await setNetwork(true);
    writeSession('sess-1');
    writeSession('sess-2');
    await settle();

    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);

    const keys = sentKeys();
    expect(keys).toHaveLength(2);
    expect(keys.at(0)).not.toEqual(keys.at(1));
  });

  it('replays a write persisted before a restart with its original key', async () => {
    await setNetwork(true);
    writeSession('sess-restart');
    await settle();

    const persisted =
      (await readOnyx<Request[]>(ONYXKEYS.PERSISTED_REQUESTS)) ?? [];
    expect(persisted).toHaveLength(1);
    const key = persisted.at(0)?.data?.idempotencyKey;
    expect(typeof key).toBe('string');

    await restartWith(persisted);
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);

    expect(sentKeys()).toEqual([key]);
  });

  it('applies a write once when the server applied it but the answer was lost', async () => {
    await setNetwork(true);
    writeSession('sess-lost');
    await settle();

    // The first attempt lands on the server, but its answer never arrives.
    const server = fakeServer();
    server.answersToLose = 1;
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);

    expect(mockXhr).toHaveBeenCalledTimes(2);
    expect(new Set(sentKeys()).size).toBe(1);
    expect(server.applications).toBe(1);
  });

  it('applies a write once when the app restarts after the server applied it', async () => {
    await setNetwork(true);
    writeSession('sess-lost-restart');
    await settle();
    const persisted =
      (await readOnyx<Request[]>(ONYXKEYS.PERSISTED_REQUESTS)) ?? [];

    // Every answer is lost until the retry budget runs out, so the write stays
    // queued on disk even though the server already applied it.
    const server = fakeServer();
    server.answersToLose = Number.POSITIVE_INFINITY;
    await setNetwork(false);
    await waitFor(() => mockXhr.mock.calls.length >= TEST_MAX_RETRIES + 1);
    await settle();
    expect(server.applications).toBe(1);

    // The app is killed and relaunched; the persisted request replays.
    server.answersToLose = 0;
    await setNetwork(true);
    await restartWith(persisted);
    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);

    expect(new Set(sentKeys()).size).toBe(1);
    expect(server.applications).toBe(1);
  });
});
