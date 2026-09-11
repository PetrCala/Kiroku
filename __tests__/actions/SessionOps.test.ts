/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds/asserts Onyx directly to model the queue */

/**
 * The session op helper on the real write pipeline (SessionOps -> API.write
 * -> SequentialQueue -> PersistedRequests -> middleware), with only the HTTP
 * layer stubbed: ops are flagged off by default, carry their id as the
 * idempotency key and a server-time `client_ts`, and edits to the same entry
 * coalesce in the queue.
 */
import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as PersistedRequests from '@userActions/PersistedRequests';
import * as SessionOps from '@userActions/SessionOps';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type OnyxRequest from '@src/types/onyx/Request';

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

let mockSessionOpsEnabled = true;
jest.mock('@libs/FeatureFlags', () => ({
  isEnabled: (flag: string) => flag === 'SESSION_OPS' && mockSessionOpsEnabled,
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

const SESSION = '-NsessionPushId01';
const {EDIT_ENTRY, ADD_ENTRY, PING} = CONST.SESSION_OP.TYPE;

function marker(value: number): OnyxUpdate {
  return {
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.IS_LOADING_APP,
    value: value > 0,
  };
}

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

async function setNetwork(isOffline: boolean): Promise<void> {
  await Onyx.merge(ONYXKEYS.NETWORK, {isOffline});
  await settle();
}

/** The session ops waiting in the queue. */
function queuedOps(): OnyxRequest[] {
  return PersistedRequests.getAll().filter(
    request => request.command === WRITE_COMMANDS.SESSION_OP,
  );
}

/** The data of every session op that reached the HTTP layer. */
function sentOps(): Array<Record<string, unknown>> {
  return mockXhr.mock.calls
    .filter(([command]) => command === WRITE_COMMANDS.SESSION_OP)
    .map(([, data]: [string, Record<string, unknown>]) => data);
}

function editEntry(payload: Record<string, unknown>, failure?: OnyxUpdate) {
  return SessionOps.sendSessionOp(
    {sessionId: SESSION, type: EDIT_ENTRY, payload},
    failure ? {failureData: [failure]} : {},
  );
}

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
  mockSessionOpsEnabled = true;
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

describe('Session ops (real write pipeline)', () => {
  it('sends nothing while SESSION_OPS is off', async () => {
    mockSessionOpsEnabled = false;
    const opId = SessionOps.sendSessionOp({sessionId: SESSION, type: PING});
    await settle();

    expect(opId).toBeUndefined();
    expect(queuedOps()).toHaveLength(0);
    expect(sentOps()).toHaveLength(0);
  });

  it('sends the envelope with the op id as its idempotency key', async () => {
    const opId = SessionOps.sendSessionOp({sessionId: SESSION, type: PING});
    await waitFor(() => sentOps().length === 1);

    expect(sentOps().at(0)).toMatchObject({
      opId,
      idempotencyKey: opId,
      sessionId: SESSION,
      type: PING,
      payload: {},
      client_ts: expect.any(Number) as number,
    });
  });

  it('stamps client_ts on the server clock', async () => {
    await Onyx.merge(ONYXKEYS.NETWORK, {timeSkew: 60_000});
    await settle();

    const before = Date.now();
    SessionOps.sendSessionOp({sessionId: SESSION, type: PING});
    await waitFor(() => sentOps().length === 1);

    const clientTs = sentOps().at(0)?.client_ts as number;
    expect(clientTs - before).toBeGreaterThanOrEqual(60_000);
    expect(clientTs - before).toBeLessThan(61_000);
  });

  it('coalesces two edits to the same entry into one op under the later id', async () => {
    await setNetwork(true);
    const first = editEntry({entryId: 'e1', count: 1, note: 'a'}, marker(1));
    const second = editEntry({entryId: 'e1', count: 3}, marker(-1));
    await settle();

    const queued = queuedOps();
    expect(queued).toHaveLength(1);
    expect(first).not.toEqual(second);
    expect(queued.at(0)?.data).toMatchObject({
      opId: second,
      idempotencyKey: second,
      type: EDIT_ENTRY,
      payload: {entryId: 'e1', count: 3, note: 'a'},
    });
    // Both ops' rollbacks survive the merge, newest first.
    expect(queued.at(0)?.failureData).toEqual([marker(-1), marker(1)]);

    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);
    expect(sentOps()).toHaveLength(1);
    expect(sentOps().at(0)?.idempotencyKey).toBe(second);
  });

  it('folds an edit into the queued add of the same entry', async () => {
    await setNetwork(true);
    SessionOps.sendSessionOp({
      sessionId: SESSION,
      type: ADD_ENTRY,
      payload: {entryId: 'e1', drink: 'beer', count: 1},
    });
    editEntry({entryId: 'e1', count: 2});
    await settle();

    expect(queuedOps()).toHaveLength(1);
    expect(queuedOps().at(0)?.data).toMatchObject({
      type: ADD_ENTRY,
      payload: {entryId: 'e1', drink: 'beer', count: 2},
    });
  });

  it('keeps ops apart when another op of the session sits in between', async () => {
    await setNetwork(true);
    editEntry({entryId: 'e1', count: 1});
    SessionOps.sendSessionOp({
      sessionId: SESSION,
      type: ADD_ENTRY,
      payload: {entryId: 'e2', count: 1},
    });
    editEntry({entryId: 'e1', count: 2});
    await settle();

    expect(queuedOps().map(request => request.data?.type)).toEqual([
      EDIT_ENTRY,
      ADD_ENTRY,
      EDIT_ENTRY,
    ]);
  });

  it('never folds into an op that was already attempted', async () => {
    await setNetwork(true);
    const attempted: OnyxRequest = {
      command: WRITE_COMMANDS.SESSION_OP,
      data: {
        opId: '11111111-2222-4333-8444-555555555555',
        idempotencyKey: '11111111-2222-4333-8444-555555555555',
        sessionId: SESSION,
        type: EDIT_ENTRY,
        payload: {entryId: 'e1', count: 1},
        client_ts: 1,
      },
      isRollbacked: true,
    };
    await Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, [attempted]);
    await settle();

    editEntry({entryId: 'e1', count: 2});
    await settle();

    expect(queuedOps()).toHaveLength(2);
  });
});
