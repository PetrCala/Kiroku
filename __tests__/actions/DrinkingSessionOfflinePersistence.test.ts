/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds/asserts Onyx directly to model offline persistence across an app restart */

/**
 * Offline persistence coverage for the LIVE (ongoing) drinking session.
 *
 * Models the "start a live session fully offline, add drinks, close the app,
 * reopen" flow over the REAL write pipeline — API.write -> SequentialQueue ->
 * PersistedRequests — against real Onyx and the real DrinkingSessionUtils
 * caches, with only the HTTP layer stubbed.
 *
 * The regression under test: live-session edits made offline used to vanish on
 * the next app launch unless the user explicitly saved the session before
 * closing the app. Three holes compounded:
 *   1. `syncLocalLiveSessionData` treated a not-yet-hydrated sessions snapshot
 *      as "no ongoing session" and wiped `ONGOING_SESSION_DATA` — the only copy
 *      of the offline session's drinks — on every cold start.
 *   2. Its "buffer has un-persisted edits" guard was in-memory only, so after a
 *      restart the buffer was rolled back to the stale cached snapshot even
 *      though the un-sent edits were still sitting in the offline queue.
 *   3. The debounced live persist never fired when the app was backgrounded or
 *      killed within its 500ms window (a backgrounded app runs no JS timers),
 *      so the tapped drinks never reached the durable request queue at all.
 */
import Onyx from 'react-native-onyx';
import type {OnyxKey} from 'react-native-onyx';
import type {AppStateStatus} from 'react-native';
import type {User} from 'firebase/auth';
import * as DS from '@userActions/DrinkingSession';
import * as PersistedRequests from '@userActions/PersistedRequests';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import {getDrinkCount} from '@libs/DrinkEntryUtils';
import {WRITE_COMMANDS} from '@libs/API/types';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
  DrinkingSession,
  DrinksList,
  Request,
  UserDrinkingSessionsList,
} from '@src/types/onyx';

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

// Captured AppState 'change' listeners so the tests can drive the action
// module's background-flush path deterministically. Declared as a
// `mock`-prefixed lazy `var` so babel-plugin-jest-hoist lets the hoisted mock
// factory reference it.
// eslint-disable-next-line no-var
var mockAppStateListeners: Array<(state: AppStateStatus) => void> | undefined;

// Deliver everything the modules under test read from react-native at runtime:
// AppState (background-flush listener), a synchronous InteractionManager, and
// Alert. Everything else delegates to the real module.
jest.mock('react-native', () => {
  const reactNative =
    jest.requireActual<Record<string, unknown>>('react-native');
  return Object.setPrototypeOf(
    {
      Alert: {alert: jest.fn()},
      AppState: {
        currentState: 'active',
        addEventListener: (
          type: string,
          listener: (state: AppStateStatus) => void,
        ) => {
          if (type === 'change') {
            mockAppStateListeners ??= [];
            mockAppStateListeners.push(listener);
          }
          return {remove: jest.fn()};
        },
      },
      InteractionManager: {
        runAfterInteractions: (callback: () => void) => {
          callback();
          return {cancel: jest.fn()};
        },
      },
    },
    reactNative,
  ) as Record<string, unknown>;
});

// Capture every outbound request and resolve it as a server 200, like a real
// reconnect replay would.
const mockXhr = jest.fn<Promise<unknown>, [string, Record<string, unknown>]>();
jest.mock('@libs/HttpUtils', () => ({
  __esModule: true,
  default: {
    xhr: (command: string, data: Record<string, unknown>): Promise<unknown> =>
      mockXhr(command, data),
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

jest.mock('@libs/generatePushID', () => ({
  __esModule: true,
  default: jest.fn(() => 'live-1'),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {navigate: jest.fn(), dismissModal: jest.fn()},
}));

jest.mock('@libs/Localize', () => ({translateLocal: (key: string) => key}));

const ME = 'user-1';
const SESSION_ID = 'live-1';
const USER = {uid: ME} as unknown as User;
const DRINKS_TO_UNITS = {beer: 1} as never;

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
  for (let i = 0; i < 12; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0);
    });
  }
}

// Read a single Onyx key once. Uses Onyx.connect because this action test has
// no React render context for useOnyx().
function readOnyx<T>(key: OnyxKey): Promise<T | undefined> {
  return new Promise<T | undefined>(resolve => {
    // eslint-disable-next-line rulesdir/no-onyx-connect, rulesdir/prefer-onyx-connect-in-libs -- test-only Onyx read; useOnyx() requires a React render this test doesn't have
    const connection = Onyx.connect({
      key,
      callback: (value: unknown) => {
        Onyx.disconnect(connection);
        resolve((value ?? undefined) as T | undefined);
      },
    });
  });
}

// Drive the action module's AppState listener (the background-flush path).
function emitAppState(state: AppStateStatus) {
  (mockAppStateListeners ?? []).forEach(listener => listener(state));
}

function makeOngoingSession(drinks?: DrinksList): DrinkingSession {
  return {
    id: SESSION_ID,
    start_time: 1_000,
    end_time: 1_000,
    blackout: false,
    note: '',
    timezone: 'Europe/Prague',
    type: CONST.SESSION.TYPES.LIVE,
    ongoing: true,
    ...(drinks ? {drinks} : {}),
  };
}

/** A queued live UpdateSession request, shaped like API.write persists it. */
function updateSessionRequest(session: DrinkingSession): Request {
  return {
    command: WRITE_COMMANDS.UPDATE_SESSION,
    data: {
      sessionId: SESSION_ID,
      session,
      sessionIsLive: true,
      apiRequestType: CONST.API_REQUEST_TYPE.WRITE,
      canCancel: true,
      shouldRetry: true,
    },
    initiatedOffline: true,
  };
}

function countBeers(session: DrinkingSession | undefined): number {
  return Object.values(session?.drinks ?? {}).reduce(
    (sum, drinks) => sum + getDrinkCount(drinks?.beer),
    0,
  );
}

function queuedLiveUpdates(): Request[] {
  return PersistedRequests.getAll().filter(
    request => request.command === WRITE_COMMANDS.UPDATE_SESSION,
  );
}

function sessionOf(request: Request | undefined): DrinkingSession | undefined {
  return (request?.data as {session?: DrinkingSession} | undefined)?.session;
}

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
  mockXhr.mockReset();
  mockXhr.mockImplementation(() => okResponse());
  SequentialQueue.resetQueue();
  await Onyx.clear();
  await settle();
  // Reset the action module's in-memory debounce state left by a prior test:
  // backgrounding cancels the timers, and the flush no-ops against the cleared
  // buffer.
  emitAppState('background');
  emitAppState('active');
  // Resolve NetworkStore readiness (it waits for SESSION + CREDENTIALS).
  await Onyx.multiSet({
    [ONYXKEYS.SESSION]: {authToken: 'tok'},
    [ONYXKEYS.CREDENTIALS]: {},
  });
  await settle();
});

describe('offline live-session persistence (real write pipeline)', () => {
  it('keeps offline drinks durable through a background flush and replays them on reconnect', async () => {
    await Onyx.merge(ONYXKEYS.NETWORK, {isOffline: true});
    await settle();

    await DS.startLiveDrinkingSession(USER, undefined);
    await settle();

    DS.updateDrinks(
      SESSION_ID,
      CONST.DRINKS.KEYS.BEER,
      2,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await settle();

    // The taps are buffered locally right away and marked un-flushed until the
    // debounce hands them to the request queue.
    expect(
      countBeers(
        await readOnyx<DrinkingSession>(ONYXKEYS.ONGOING_SESSION_DATA),
      ),
    ).toBe(2);
    expect(await readOnyx(ONYXKEYS.ONGOING_SESSION_UNFLUSHED_EDITS)).toBe(
      SESSION_ID,
    );

    // The user leaves the app before the 500ms debounce fires. A backgrounded
    // app runs no JS timers, so the flush must happen on the way out.
    emitAppState('background');
    await settle();

    const queued = queuedLiveUpdates();
    expect(queued).toHaveLength(2); // session create + the flushed drinks
    expect(countBeers(sessionOf(queued.at(1)))).toBe(2);
    expect(
      await readOnyx(ONYXKEYS.ONGOING_SESSION_UNFLUSHED_EDITS),
    ).toBeUndefined();

    // The flush also patched the cached snapshot, so Home/Stats (and a restart,
    // which renders from it) see the drinks while still offline.
    const cached = await readOnyx<UserDrinkingSessionsList>(
      ONYXKEYS.CACHED_DRINKING_SESSIONS,
    );
    expect(countBeers(cached?.[ME]?.[SESSION_ID])).toBe(2);

    // Nothing was sent while offline.
    expect(mockXhr).not.toHaveBeenCalled();

    // Back online -> both writes replay, in order, and drain the queue.
    await Onyx.merge(ONYXKEYS.NETWORK, {isOffline: false});
    await settle();

    const sent = mockXhr.mock.calls.filter(
      call => call[0] === WRITE_COMMANDS.UPDATE_SESSION,
    );
    expect(sent).toHaveLength(2);
    expect(
      countBeers((sent.at(1)?.at(1) as {session?: DrinkingSession})?.session),
    ).toBe(2);
    expect(PersistedRequests.getAll()).toHaveLength(0);
  });

  it('does not wipe the buffered live session while the snapshot has not hydrated (cold start)', async () => {
    await Onyx.set(
      ONYXKEYS.ONGOING_SESSION_DATA,
      makeOngoingSession({100: {beer: 2}}),
    );
    await settle();

    // HomeScreen's sync effect fires with `undefined` before the cached
    // snapshot hydrates on a cold start. This used to wipe the buffer.
    await DS.syncLocalLiveSessionData(null, undefined);
    await settle();

    expect(
      countBeers(
        await readOnyx<DrinkingSession>(ONYXKEYS.ONGOING_SESSION_DATA),
      ),
    ).toBe(2);
  });

  it('keeps the newer buffer when the stale snapshot arrives while the live write still sits in the queue (offline restart)', async () => {
    // State an offline restart hydrates from disk: the buffer holds the drinks,
    // the snapshot never saw them (no server echo can arrive offline), and the
    // flushed write is still queued.
    const withDrinks = makeOngoingSession({100: {beer: 2}});
    const staleSnapshot = makeOngoingSession();
    await Onyx.multiSet({
      [ONYXKEYS.NETWORK]: {isOffline: true},
      [ONYXKEYS.ONGOING_SESSION_DATA]: withDrinks,
      [ONYXKEYS.CACHED_DRINKING_SESSIONS]: {
        [ME]: {[SESSION_ID]: staleSnapshot},
      },
      [ONYXKEYS.PERSISTED_REQUESTS]: [updateSessionRequest(withDrinks)],
    });
    await settle();

    await DS.syncLocalLiveSessionData(SESSION_ID, {
      [SESSION_ID]: staleSnapshot,
    });
    await settle();

    expect(
      countBeers(
        await readOnyx<DrinkingSession>(ONYXKEYS.ONGOING_SESSION_DATA),
      ),
    ).toBe(2);
  });

  it('re-arms the persist for edits that never reached the queue (killed before the debounced flush)', async () => {
    // The app was killed within the debounce window: the un-flushed marker is
    // still set and the queue holds nothing for these drinks.
    const withDrinks = makeOngoingSession({100: {beer: 2}});
    const staleSnapshot = makeOngoingSession();
    await Onyx.multiSet({
      [ONYXKEYS.NETWORK]: {isOffline: true},
      [ONYXKEYS.ONGOING_SESSION_DATA]: withDrinks,
      [ONYXKEYS.ONGOING_SESSION_UNFLUSHED_EDITS]: SESSION_ID,
      [ONYXKEYS.CACHED_DRINKING_SESSIONS]: {
        [ME]: {[SESSION_ID]: staleSnapshot},
      },
    });
    await settle();

    await DS.syncLocalLiveSessionData(SESSION_ID, {
      [SESSION_ID]: staleSnapshot,
    });
    await settle();

    // The buffer must not roll back to the stale snapshot...
    expect(
      countBeers(
        await readOnyx<DrinkingSession>(ONYXKEYS.ONGOING_SESSION_DATA),
      ),
    ).toBe(2);

    // ...and the re-armed persist delivers the drinks into the durable queue
    // (flushed here via the background path instead of waiting out the real
    // 500ms debounce).
    emitAppState('background');
    await settle();

    const queued = queuedLiveUpdates();
    expect(queued).toHaveLength(1);
    expect(countBeers(sessionOf(queued.at(0)))).toBe(2);
    expect(
      await readOnyx(ONYXKEYS.ONGOING_SESSION_UNFLUSHED_EDITS),
    ).toBeUndefined();
  });

  it('still adopts the snapshot when the device has nothing un-delivered (cross-device update)', async () => {
    await Onyx.multiSet({
      [ONYXKEYS.NETWORK]: {isOffline: false},
      [ONYXKEYS.ONGOING_SESSION_DATA]: makeOngoingSession(),
    });
    await settle();

    const remote = makeOngoingSession({200: {beer: 3}});
    await DS.syncLocalLiveSessionData(SESSION_ID, {[SESSION_ID]: remote});
    await settle();

    expect(
      countBeers(
        await readOnyx<DrinkingSession>(ONYXKEYS.ONGOING_SESSION_DATA),
      ),
    ).toBe(3);
  });

  it('still clears the buffer when the hydrated snapshot has no ongoing session and nothing is un-delivered', async () => {
    await Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, makeOngoingSession());
    await settle();

    // e.g. the session was finalized or discarded on another device.
    await DS.syncLocalLiveSessionData(null, {});
    await settle();

    expect(
      await readOnyx<DrinkingSession>(ONYXKEYS.ONGOING_SESSION_DATA),
    ).toBeUndefined();
  });

  it('keeps un-delivered edits even when the hydrated snapshot has no ongoing session', async () => {
    const withDrinks = makeOngoingSession({100: {beer: 2}});
    await Onyx.multiSet({
      [ONYXKEYS.NETWORK]: {isOffline: true},
      [ONYXKEYS.ONGOING_SESSION_DATA]: withDrinks,
      [ONYXKEYS.ONGOING_SESSION_UNFLUSHED_EDITS]: SESSION_ID,
    });
    await settle();

    await DS.syncLocalLiveSessionData(null, {});
    await settle();

    expect(
      countBeers(
        await readOnyx<DrinkingSession>(ONYXKEYS.ONGOING_SESSION_DATA),
      ),
    ).toBe(2);
  });
});
