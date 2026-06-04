/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views -- this test asserts on the mocked API.write pipeline; it is not a view */

import type {OnyxKey} from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';
import * as DS from '@userActions/DrinkingSession';

// Registry of captured Onyx.connect callbacks so the test can drive the
// module-level caches in DrinkingSession.ts (the live persist reads
// `ongoingSessionData` at flush time). Declared as a `mock`-prefixed, lazily
// initialized `var` so babel-plugin-jest-hoist lets the hoisted jest.mock factory
// reference it and so `var` hoisting keeps it defined when DrinkingSession.ts
// registers its callbacks at import time.
// eslint-disable-next-line no-var, vars-on-top, @typescript-eslint/init-declarations
var mockOnyxConnectCallbacks:
  | Record<string, Array<(value: unknown) => void>>
  | undefined;

// Drive the module-level caches by replaying captured connect callbacks for a key.
function driveOnyx(key: string, value: unknown) {
  (mockOnyxConnectCallbacks?.[key] ?? []).forEach(cb => cb(value));
}

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(
      ({key, callback}: {key: string; callback: (value: unknown) => void}) => {
        mockOnyxConnectCallbacks ??= {};
        (mockOnyxConnectCallbacks[key] ??= []).push(callback);
        return mockOnyxConnectCallbacks[key].length;
      },
    ),
    disconnect: jest.fn(),
    update: jest.fn(() => Promise.resolve()),
    merge: jest.fn(() => Promise.resolve()),
    set: jest.fn(() => Promise.resolve()),
    METHOD: {MERGE: 'merge', SET: 'set'},
  },
  useOnyx: jest.fn(),
}));

jest.mock('@libs/API', () => ({write: jest.fn()}));

// Run the debounced persist's deferred body synchronously when the InteractionManager
// callback is invoked, and hand back a cancel handle the action layer can call.
jest.mock('react-native', () => ({
  Alert: {alert: jest.fn()},
  InteractionManager: {
    runAfterInteractions: jest.fn((callback: () => void) => {
      callback();
      return {cancel: jest.fn()};
    }),
  },
}));

jest.mock('firebase/database', () => ({
  get: jest.fn(),
  limitToFirst: jest.fn(),
  orderByChild: jest.fn(),
  query: jest.fn(),
  ref: jest.fn(),
  update: jest.fn(),
}));
jest.mock('@database/baseFunctions', () => ({
  generateDatabaseKey: jest.fn(() => 'generated-id'),
}));
jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {navigate: jest.fn(), dismissModal: jest.fn()},
}));
jest.mock('@libs/Localize', () => ({translateLocal: (key: string) => key}));
jest.mock('@libs/DrinkingSessionUtils');

const mockedWrite = jest.mocked(API.write);
const mockedDSUtils = jest.mocked(DSUtils);

const DRINKS_TO_UNITS = {beer: 1} as never;

function makeOngoing(id: string): DrinkingSession {
  return {
    id,
    start_time: 1_000,
    end_time: 1_000,
    blackout: false,
    note: '',
    timezone: 'Europe/Prague',
    type: CONST.SESSION.TYPES.LIVE,
    ongoing: true,
    drinks: {},
  };
}

/** Route `updateDrinks` into the given onyx key, returning a live drink list. */
function routeTo(
  onyxKey: OnyxKey | null,
  session: DrinkingSession | undefined,
) {
  mockedDSUtils.getDrinkingSessionData.mockReturnValue(session);
  mockedDSUtils.getDrinkingSessionOnyxKey.mockReturnValue(onyxKey);
  mockedDSUtils.modifySessionDrinks.mockReturnValue({1_000: {beer: 1}});
}

function tap(sessionId = 's1') {
  DS.updateDrinks(
    sessionId,
    CONST.DRINKS.KEYS.BEER,
    1,
    CONST.DRINKS.ACTIONS.ADD,
    DRINKS_TO_UNITS,
  );
}

function liveUpdateCalls() {
  return mockedWrite.mock.calls.filter(
    call => call[0] === WRITE_COMMANDS.UPDATE_SESSION,
  );
}

/** Extract the `session` payload from a captured UPDATE_SESSION write call. */
function sessionOf(
  call: ReturnType<typeof liveUpdateCalls>[number],
): DrinkingSession | undefined {
  return (call[1] as {session?: DrinkingSession}).session;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.clearAllTimers();
  // Reset the DrinkingSession.ts module cache the flush reads.
  driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, null);
  mockedDSUtils.clearOngoingSessionCache.mockReset();
});

describe('live-session persistence', () => {
  it('debounces a tap burst into a single UPDATE_SESSION with no optimistic data', () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    tap();
    tap();
    tap();
    // Debounced: nothing is written until the user pauses.
    expect(mockedWrite).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);

    expect(liveUpdateCalls()).toHaveLength(1);
    const call = liveUpdateCalls()[0];
    expect(call[1]).toEqual({
      sessionId: 's1',
      session,
      sessionIsLive: true,
    });
    // No third onyxData arg → no optimistic cachedDrinkingSessions merge.
    expect(call).toHaveLength(2);
  });

  it('synchronously caches the composed session so rapid taps compose on the latest', () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    tap();

    // updateDrinks must push the freshly-composed session into the synchronous
    // cache (not wait on Onyx.connect), so a follow-up remove reads it instead of
    // a stale base and its Onyx.set can't wipe un-propagated adds.
    expect(mockedDSUtils.setLocalSessionCache).toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_DATA,
      expect.objectContaining({drinks: {1_000: {beer: 1}}}),
    );
  });

  it('does not persist edit sessions through the live pipeline', () => {
    const session = {...makeOngoing('e1'), type: CONST.SESSION.TYPES.EDIT};
    routeTo(ONYXKEYS.EDIT_SESSION_DATA, session);

    tap('e1');
    jest.advanceTimersByTime(500);

    expect(mockedWrite).not.toHaveBeenCalled();
  });

  it('skips the flush if the session is no longer ongoing at flush time', () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    tap();
    // The session is finalized/cleared before the debounce fires.
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, null);
    jest.advanceTimersByTime(500);

    expect(mockedWrite).not.toHaveBeenCalled();
  });
});

describe('finalize is the deterministic last writer', () => {
  it('cancels a pending live persist when the session is saved', async () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    tap(); // arms the debounce timer

    await DS.saveDrinkingSessionData(
      'uid',
      {...session, ongoing: false},
      's1',
      ONYXKEYS.ONGOING_SESSION_DATA,
      true,
    );

    expect(mockedDSUtils.clearOngoingSessionCache).toHaveBeenCalledTimes(1);
    expect(liveUpdateCalls()).toHaveLength(1);
    expect(liveUpdateCalls()[0][1]).toEqual(
      expect.objectContaining({
        sessionId: 's1',
        sessionIsLive: true,
        session: expect.objectContaining({ongoing: false}),
      }),
    );

    // The cancelled debounce must not fire a trailing live write.
    jest.advanceTimersByTime(500);
    expect(liveUpdateCalls()).toHaveLength(1);
  });

  it('keeps the finalize last when a tap lands after Save (save-mid-tap)', async () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    // Rapid tapping, then Save.
    tap();
    tap();

    // Saving synchronously clears the ongoing cache; model that by routing any
    // later tap to a dead end (the real clearOngoingSessionCache makes
    // getDrinkingSessionOnyxKey return null).
    mockedDSUtils.clearOngoingSessionCache.mockImplementation(() => {
      routeTo(null, undefined);
      driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, null);
    });

    await DS.saveDrinkingSessionData(
      'uid',
      {...session, ongoing: false},
      's1',
      ONYXKEYS.ONGOING_SESSION_DATA,
      true,
    );

    // A straggler tap whose handler runs after Save must be a no-op.
    tap();
    jest.advanceTimersByTime(500);

    const updates = liveUpdateCalls();
    expect(updates).toHaveLength(1);
    expect(sessionOf(updates[0])?.ongoing).toBe(false);
    // No live write ever re-asserted ongoing:true after the finalize.
    expect(
      updates.filter(call => sessionOf(call)?.ongoing === true),
    ).toHaveLength(0);
  });

  it('cancels a pending live persist when the session is discarded', async () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    tap();

    await DS.removeDrinkingSessionData(
      'uid',
      's1',
      ONYXKEYS.ONGOING_SESSION_DATA,
      true,
    );

    expect(mockedDSUtils.clearOngoingSessionCache).toHaveBeenCalledTimes(1);
    // Discard issues a DELETE_SESSION, never an UPDATE_SESSION.
    jest.advanceTimersByTime(500);
    expect(liveUpdateCalls()).toHaveLength(0);
    expect(
      mockedWrite.mock.calls.filter(
        call => call[0] === WRITE_COMMANDS.DELETE_SESSION,
      ),
    ).toHaveLength(1);
  });
});
