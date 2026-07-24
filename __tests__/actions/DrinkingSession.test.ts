/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views -- this test asserts on the mocked API.write pipeline; it is not a view */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test references the mocked Onyx.merge/set to assert what the action issues; it is not app code */

import type {OnyxKey} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
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
// The action layer detects this synchronous completion and must not store the
// handle as a pending task (see scheduleLiveSessionPersist).
jest.mock('react-native', () => ({
  Alert: {alert: jest.fn()},
  InteractionManager: {
    runAfterInteractions: jest.fn((callback: () => void) => {
      callback();
      return {cancel: jest.fn()};
    }),
  },
}));

jest.mock('@libs/generatePushID', () => ({
  __esModule: true,
  default: jest.fn(() => 'generated-id'),
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

/**
 * Let the debounced live persist run to completion (or prove it has nothing to
 * run): past the 500ms debounce the mocked InteractionManager runs the flush
 * synchronously.
 */
function runLivePersistDebounce() {
  jest.advanceTimersByTime(500);
}

/** Extract the `session` payload from a captured UPDATE_SESSION write call. */
function sessionOf(
  call: ReturnType<typeof liveUpdateCalls>[number],
): DrinkingSession | undefined {
  return (call[1] as {session?: DrinkingSession}).session;
}

// Install fake timers ONCE for the whole suite (jest/setupAfterEnv.ts forces
// real timers per file). Per-test useFakeTimers would re-install and DISCARD
// pending timers without running them, leaking the module-level persist
// handles (`hasPendingLiveSessionPersist` would read armed-forever).
beforeAll(() => {
  jest.useFakeTimers();
});

beforeEach(() => {
  // Drain whatever a previous test left armed (debounce and/or interaction
  // task) so the module-level pending handles reset, then clear the mock calls
  // that draining produced.
  jest.runAllTimers();
  jest.clearAllMocks();
  // Reset the DrinkingSession.ts module caches the flush and sync guards read.
  driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, null);
  driveOnyx(ONYXKEYS.ONGOING_SESSION_SYNC, null);
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

    runLivePersistDebounce();

    expect(liveUpdateCalls()).toHaveLength(1);
    const call = liveUpdateCalls()[0];
    expect(call[1]).toEqual({
      sessionId: 's1',
      session,
      sessionIsLive: true,
    });
    // No optimistic cachedDrinkingSessions merge; the flush only carries
    // successData (the sync acknowledgement stamp), which applies off the
    // touch frame when the response lands.
    const onyxData = call[2] as
      | {optimisticData?: unknown; successData?: Array<{key: string}>}
      | undefined;
    expect(onyxData?.optimisticData).toBeUndefined();
    expect(onyxData?.successData).toEqual([
      expect.objectContaining({key: ONYXKEYS.ONGOING_SESSION_SYNC}),
    ]);
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
    runLivePersistDebounce();

    expect(mockedWrite).not.toHaveBeenCalled();
  });

  it('skips the flush if the session is no longer ongoing at flush time', () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    tap();
    // The session is finalized/cleared before the debounce fires.
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, null);
    runLivePersistDebounce();

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
    runLivePersistDebounce();
    expect(liveUpdateCalls()).toHaveLength(1);
  });

  it('clean-replaces the cached session on save so removed drinks do not linger', async () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    await DS.saveDrinkingSessionData(
      'uid',
      {...session, ongoing: false},
      's1',
      ONYXKEYS.ONGOING_SESSION_DATA,
      true,
    );

    const onyxData = liveUpdateCalls()[0][2] as {
      optimisticData?: Array<{
        key: string;
        value: Record<string, Record<string, unknown>>;
      }>;
    };
    const cacheWrites = (onyxData.optimisticData ?? []).filter(
      update => update.key === ONYXKEYS.CACHED_DRINKING_SESSIONS,
    );
    // A merge can't drop removed drinks, so the finalize must delete the cached
    // entry first, then re-add the finalized session.
    expect(cacheWrites).toHaveLength(2);
    expect(cacheWrites[0].value).toEqual({uid: {s1: null}});
    expect(cacheWrites[1].value.uid.s1).toEqual(
      expect.objectContaining({ongoing: false}),
    );
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
    runLivePersistDebounce();

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
    runLivePersistDebounce();
    expect(liveUpdateCalls()).toHaveLength(0);
    expect(
      mockedWrite.mock.calls.filter(
        call => call[0] === WRITE_COMMANDS.DELETE_SESSION,
      ),
    ).toHaveLength(1);
  });
});

describe('offline live-session persistence across restarts', () => {
  // The module is fully mocked above; these are the jest.fn instances the
  // action layer writes through. Typed explicitly (not the bare `jest.Mock`
  // the real `Onyx.set`/`Onyx.merge` declarations widen to) so `.mock.calls`
  // stays a known tuple instead of `any`.
  const mockedOnyx = {
    set: Onyx.set as unknown as jest.Mock<Promise<void>, [OnyxKey, unknown]>,
    merge: Onyx.merge as unknown as jest.Mock<
      Promise<void>,
      [OnyxKey, unknown]
    >,
  };

  /** The stamp of the last persisted ONGOING_SESSION_SYNC write. */
  function lastSyncMarker(): {sessionId: string; editedAt: number} {
    const setCalls = mockedOnyx.set.mock.calls.filter(
      call => call[0] === ONYXKEYS.ONGOING_SESSION_SYNC && call[1] !== null,
    );
    return setCalls[setCalls.length - 1][1] as {
      sessionId: string;
      editedAt: number;
    };
  }

  it('stamps a persisted un-synced edit marker on every live tap', () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    tap();

    // Assert via the typed helper (not `expect.any(Number)`, which is `any`
    // and trips the type-checked lint): a marker for this session with a
    // numeric edit stamp was persisted.
    const marker = lastSyncMarker();
    expect(marker.sessionId).toBe('s1');
    expect(typeof marker.editedAt).toBe('number');
  });

  it('flush stamps enqueuedAt synchronously and acknowledges via successData', () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    tap();
    const {editedAt} = lastSyncMarker();
    // The marker must feed the flush through the synchronous module cache, not
    // wait on an Onyx.connect round-trip, so no driveOnyx here on purpose.
    runLivePersistDebounce();

    // Enqueued: stamped at flush time so a restart won't re-enqueue these edits.
    expect(mockedOnyx.merge).toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_SYNC,
      {enqueuedAt: editedAt},
    );
    // Synced: only a successful response may clear the dirty state. Dropped:
    // if the queue permanently drops the request, failureData re-opens the
    // "never enqueued" state so the persist re-arms and re-sends.
    const call = liveUpdateCalls()[0];
    expect(call[2]).toEqual({
      successData: [
        expect.objectContaining({
          key: ONYXKEYS.ONGOING_SESSION_SYNC,
          value: {syncedAt: editedAt},
        }),
      ],
      failureData: [
        expect.objectContaining({
          key: ONYXKEYS.ONGOING_SESSION_SYNC,
          value: {enqueuedAt: null, flushDropCount: 1},
        }),
      ],
    });
  });

  it('never touches the buffer while the snapshot has not hydrated', async () => {
    const session = {...makeOngoing('s1'), drinks: {1_000: {beer: 2}}};
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);

    // Cold start: the cached snapshot has not loaded yet (undefined). This used
    // to Onyx.set(ONGOING_SESSION_DATA, null) and destroy the persisted buffer.
    await DS.syncLocalLiveSessionData(null, undefined);

    expect(mockedOnyx.set).not.toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_DATA,
      expect.anything(),
    );
  });

  it('keeps un-synced offline edits instead of rolling back to a stale snapshot', async () => {
    // Restart state: buffer hydrated with offline drinks, marker says the
    // edits were enqueued but never acknowledged (the queue is waiting for
    // connectivity), no in-memory debounce (it died with the app).
    const buffered = {...makeOngoing('s1'), drinks: {1_000: {beer: 2}}};
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, buffered);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_SYNC, {
      sessionId: 's1',
      editedAt: 100,
      enqueuedAt: 100,
    });

    // The snapshot only has the optimistic (empty) session from session start.
    const stale = makeOngoing('s1');
    await DS.syncLocalLiveSessionData('s1', {s1: stale});

    expect(mockedOnyx.set).not.toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_DATA,
      expect.anything(),
    );
    expect(mockedDSUtils.setLocalSessionCache).not.toHaveBeenCalled();
  });

  it('adopts the snapshot once the server has acknowledged every local edit', async () => {
    const buffered = makeOngoing('s1');
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, buffered);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_SYNC, {
      sessionId: 's1',
      editedAt: 100,
      enqueuedAt: 100,
      syncedAt: 100,
    });

    const serverSession = {...makeOngoing('s1'), drinks: {2_000: {beer: 3}}};
    await DS.syncLocalLiveSessionData('s1', {s1: serverSession});

    expect(mockedOnyx.set).toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_DATA,
      expect.objectContaining({id: 's1', drinks: {2_000: {beer: 3}}}),
    );
  });

  it('clears the buffer when the loaded snapshot has no ongoing session and nothing is un-synced', async () => {
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, {
      ...makeOngoing('s1'),
      ongoing: false,
    });

    await DS.syncLocalLiveSessionData(null, {});

    expect(mockedOnyx.set).toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_DATA,
      null,
    );
  });

  it('keeps an un-synced offline session even when the snapshot lacks it', async () => {
    const buffered = {...makeOngoing('s1'), drinks: {1_000: {beer: 2}}};
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, buffered);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_SYNC, {sessionId: 's1', editedAt: 100});

    await DS.syncLocalLiveSessionData(null, {});

    expect(mockedOnyx.set).not.toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_DATA,
      null,
    );
  });

  it('re-arms the persist on launch for edits killed inside the debounce window', () => {
    // Restart state: buffer hydrated with drinks whose flush never ran (the
    // app was killed inside the 500ms debounce), so editedAt > enqueuedAt.
    const buffered = {...makeOngoing('s1'), drinks: {1_000: {beer: 2}}};
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, buffered);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_SYNC, {sessionId: 's1', editedAt: 100});

    runLivePersistDebounce();

    const updates = liveUpdateCalls();
    expect(updates).toHaveLength(1);
    expect(sessionOf(updates[0])).toEqual(buffered);
    expect(mockedOnyx.merge).toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_SYNC,
      {enqueuedAt: 100},
    );
  });

  it('does not re-arm when the queued request already covers the edits', () => {
    const buffered = {...makeOngoing('s1'), drinks: {1_000: {beer: 2}}};
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, buffered);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_SYNC, {
      sessionId: 's1',
      editedAt: 100,
      enqueuedAt: 100,
    });

    runLivePersistDebounce();

    expect(liveUpdateCalls()).toHaveLength(0);
  });

  it('clears the sync marker when the live session is finalized', async () => {
    const session = makeOngoing('s1');
    routeTo(ONYXKEYS.ONGOING_SESSION_DATA, session);
    driveOnyx(ONYXKEYS.ONGOING_SESSION_DATA, session);
    tap();

    await DS.saveDrinkingSessionData(
      'uid',
      {...session, ongoing: false},
      's1',
      ONYXKEYS.ONGOING_SESSION_DATA,
      true,
    );

    expect(mockedOnyx.set).toHaveBeenCalledWith(
      ONYXKEYS.ONGOING_SESSION_SYNC,
      null,
    );
  });
});

describe('updateSessionDate shifts in the session timezone', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  // Pin the "device" timezone to one that differs from every session timezone
  // used below, so these assertions exercise the device-tz ≠ session-tz path
  // (the bug). The computed delta must depend only on the session timezone, so
  // it stays correct regardless of this value.
  const originalTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Pacific/Honolulu';
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });
  beforeEach(() => {
    // Pass the session through unchanged so the (real) updateLocalData runs and
    // we can assert on the millisecond shift this helper receives.
    mockedDSUtils.shiftSessionTimestamps.mockImplementation(
      (s: DrinkingSession) => s,
    );
  });

  function makeEditSession(
    startTime: number,
    timezone: DrinkingSession['timezone'],
  ): DrinkingSession {
    return {
      id: 's1',
      start_time: startTime,
      end_time: startTime,
      blackout: false,
      note: '',
      timezone,
      type: CONST.SESSION.TYPES.EDIT,
      drinks: {},
    };
  }

  it('does not shift when the picked day already matches the session-tz day', async () => {
    // 2026-06-05 06:30 UTC is still 2026-06-04 23:30 in Los Angeles, so picking
    // June 4 is a no-op. Device-local (UTC/Honolulu) math would see June 5 and
    // wrongly shift by a day.
    const session = makeEditSession(
      Date.UTC(2026, 5, 5, 6, 30),
      'America/Los_Angeles',
    );

    await DS.updateSessionDate('s1', session, new Date(2026, 5, 4));

    expect(mockedDSUtils.shiftSessionTimestamps).toHaveBeenCalledWith(
      session,
      0,
    );
  });

  it('shifts by the calendar-day delta measured in the session tz', async () => {
    // Same instant (June 4 in LA); moving it to June 6 is a +2 calendar-day
    // move. The buggy device-local path would compute only +1.
    const session = makeEditSession(
      Date.UTC(2026, 5, 5, 6, 30),
      'America/Los_Angeles',
    );

    await DS.updateSessionDate('s1', session, new Date(2026, 5, 6));

    expect(mockedDSUtils.shiftSessionTimestamps).toHaveBeenCalledWith(
      session,
      -2 * DAY_MS,
    );
  });

  it('computes the delta for a standard (non-diverging) session tz', async () => {
    // June 5 10:00 UTC is June 5 12:00 in Prague; moving to June 8 is -3 days.
    const session = makeEditSession(
      Date.UTC(2026, 5, 5, 10, 0),
      'Europe/Prague',
    );

    await DS.updateSessionDate('s1', session, new Date(2026, 5, 8));

    expect(mockedDSUtils.shiftSessionTimestamps).toHaveBeenCalledWith(
      session,
      -3 * DAY_MS,
    );
  });
});
