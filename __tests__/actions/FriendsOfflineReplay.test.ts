/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views -- this integration test drives the real API.write/SequentialQueue pipeline; it is not a view */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds/asserts Onyx directly to model offline persistence and replay */

/**
 * End-to-end offline-replay coverage for the friend actions.
 *
 * Unlike Friends.test.ts (which mocks API.write and asserts onyxData shapes),
 * this suite exercises the REAL write pipeline — API.write -> SequentialQueue ->
 * PersistedRequests -> Request middleware -> HttpUtils — against real Onyx, with
 * only the HTTP layer stubbed. It proves an offline friend-accept is persisted
 * while offline and actually replayed to the server, both on a live reconnect
 * and on the first online signal after an app reload (a request persisted during
 * a prior offline session).
 */
import Onyx from 'react-native-onyx';
import type {OnyxKey} from 'react-native-onyx';
import * as Friends from '@userActions/Friends';
import * as PersistedRequests from '@userActions/PersistedRequests';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import {WRITE_COMMANDS} from '@libs/API/types';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Request} from '@src/types/onyx';

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

// Capture every outbound request and resolve it as a server 200 so successData
// (the deferred friend-move) is applied just like a real reconnect.
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

const ME = 'user-1';
const OTHER = 'friend-2';

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

type UserDataList = Record<
  string,
  {friends?: Record<string, unknown>; friend_requests?: Record<string, unknown>}
>;

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
  mockXhr.mockReset();
  mockXhr.mockImplementation(() => okResponse());
  SequentialQueue.resetQueue();
  await Onyx.clear();
  // Resolve NetworkStore readiness (it waits for SESSION + CREDENTIALS to be
  // read). Intentionally do NOT seed the NETWORK key here — the reload test
  // below relies on the very first NETWORK signal being an online one.
  await Onyx.multiSet({
    [ONYXKEYS.SESSION]: {authToken: 'tok'},
    [ONYXKEYS.CREDENTIALS]: {},
  });
  await settle();
});

describe('Friends offline replay (real write pipeline)', () => {
  // Runs first, while NetworkStore has not yet confirmed connectivity, so this
  // models a cold launch where no offline->online transition occurs.
  it('replays an accept persisted during a prior offline session on the first online signal after reload', async () => {
    // A request left on "disk" by a previous, offline app run. (The live test
    // below exercises the full successData finalisation; here we only need to
    // prove the persisted request is actually replayed to the server on boot.)
    const persisted: Request = {
      command: WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST,
      data: {
        fromUserId: OTHER,
        apiRequestType: CONST.API_REQUEST_TYPE.WRITE,
        canCancel: true,
        shouldRetry: true,
      },
      initiatedOffline: true,
    };
    await Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, [persisted]);
    await settle();

    // Nothing has flushed yet: no NETWORK signal has arrived.
    expect(mockXhr).not.toHaveBeenCalled();

    // The NetInfo bridge writes the NETWORK key online on boot. This first
    // authoritative online signal must flush the persisted queue.
    await Onyx.merge(ONYXKEYS.NETWORK, {isOffline: false});
    await settle();

    expect(mockXhr).toHaveBeenCalledWith(
      WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST,
      expect.objectContaining({fromUserId: OTHER}),
    );
    expect(PersistedRequests.getAll()).toHaveLength(0);
  });

  it('queues an offline accept and replays it to the server on live reconnect', async () => {
    // Go offline, then accept a request.
    await Onyx.merge(ONYXKEYS.NETWORK, {isOffline: true});
    await settle();
    Friends.acceptFriendRequest(OTHER);
    await settle();

    // The write is persisted, not sent.
    expect(
      PersistedRequests.getAll().map(request => request.command),
    ).toContain(WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST);
    expect(mockXhr).not.toHaveBeenCalled();

    // Back online -> the queue flushes and the accept is sent.
    await Onyx.merge(ONYXKEYS.NETWORK, {isOffline: false});
    await settle();

    expect(mockXhr).toHaveBeenCalledWith(
      WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST,
      expect.objectContaining({fromUserId: OTHER}),
    );
    // The request left the queue, and successData finalised the friend move:
    // the counterpart becomes a friend and the pending request is cleared
    // (merging `null` deletes the nested key).
    expect(PersistedRequests.getAll()).toHaveLength(0);
    const userDataList = await readOnyx<UserDataList>(ONYXKEYS.USER_DATA_LIST);
    expect(userDataList?.[ME].friends).toMatchObject({[OTHER]: true});
    expect(userDataList?.[ME].friend_requests?.[OTHER]).toBeUndefined();
  });
});
