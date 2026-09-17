/**
 * Tests for the lock-screen sync logic (src/libs/actions/LiveActivity.ts):
 * which of start / update / end a change in the ongoing session means, and the
 * payload the native surface is handed. The platform module is mocked, so the
 * real payload assembly and diffing run.
 */
/* eslint-disable rulesdir/no-api-in-views -- this test asserts on the mocked API.write pipeline; it is not a view */
import type {DrinkingSession} from '@src/types/onyx';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {SessionEntry} from '@src/types/onyx/SessionEntries';

jest.mock('@libs/LiveActivity', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __esModule: true,
  // Created inside the factory: it runs while the hoisted imports are still
  // being evaluated, before any const at the top of this file is assigned.
  default: {
    start: jest.fn(),
    update: jest.fn(),
    end: jest.fn(),
    subscribeToPushToken: jest.fn(() => jest.fn()),
  },
}));

jest.mock('@libs/API', () => ({write: jest.fn()}));

jest.mock('@userActions/Device', () => ({
  getDeviceID: jest.fn(() => Promise.resolve('device-1')),
}));

// The default name is localized off the device locale, which is not what this
// file is about; a fixed stand-in keeps the payload assertions readable.
jest.mock('@libs/SessionName', () => ({
  getDefaultSessionName: jest.fn(() => 'Friday evening'),
}));

// eslint-disable-next-line import/first
import * as API from '@libs/API';
// eslint-disable-next-line import/first
import LiveActivityModule from '@libs/LiveActivity';
// eslint-disable-next-line import/first
import * as LiveActivity from '@userActions/LiveActivity';

const mockStart = LiveActivityModule.start as jest.Mock;
const mockUpdate = LiveActivityModule.update as jest.Mock;
const mockEnd = LiveActivityModule.end as jest.Mock;
const mockSubscribe = LiveActivityModule.subscribeToPushToken as jest.Mock;
const mockApiWrite = API.write as jest.Mock;

type PushTokenListener = (pushToken: {
  sessionId: string;
  token: string;
}) => void;

/** Hand the listener the last subscription registered a token. */
function emitPushToken(sessionId: string, token: string) {
  const calls = mockSubscribe.mock.calls as PushTokenListener[][];
  const listener = calls.at(-1)?.[0];
  listener?.({sessionId, token});
}

const START = 1_700_000_000_000;
const HOUR_MS = 60 * 60 * 1000;
const DRINKS_TO_UNITS = {beer: 1, wine: 2} as never;

/** A translate stand-in: keys through, `units` rendered as the app renders it. */
const translate = ((key: string, params?: {unitCount?: number}) => {
  if (key === 'homeScreen.liveSessionCard.units') {
    return `${params?.unitCount ?? 0} units`;
  }
  if (key === 'common.drinks') {
    return 'Drinks';
  }
  if (key === 'homeScreen.liveSessionCard.label') {
    return 'Live session';
  }
  return key;
}) as never;

function entry(key: DrinkKey, count: number, ts: number): SessionEntry {
  return {
    ts,
    key,
    count,
    source: 'phone',
    author_uid: 'me',
    target_uid: 'me',
    created_at: ts,
  };
}

function session(entries: Record<string, SessionEntry>): DrinkingSession {
  return {
    id: 'session-1',
    start_time: START,
    end_time: START,
    ongoing: true,
    blackout: false,
    schema_version: 2,
    type: 'live',
    entries,
  };
}

function sync(
  current: DrinkingSession | undefined,
  autoClose?: {preference?: number | 'never'; defaultHours?: number},
) {
  LiveActivity.sync({
    session: current,
    drinksToUnits: DRINKS_TO_UNITS,
    translate,
    autoClosePreference: autoClose?.preference,
    autoCloseDefaultHours: autoClose?.defaultHours,
  });
}

describe('LiveActivity sync', () => {
  beforeEach(() => {
    LiveActivity.reset();
    jest.clearAllMocks();
  });

  it('clears leftovers on the first sync even with nothing live', () => {
    sync(undefined);
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('says nothing on later syncs while nothing is live', () => {
    sync(undefined);
    jest.clearAllMocks();
    sync(undefined);
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it('starts an activity when a session goes live', () => {
    sync(session({a: entry('beer', 2, START)}));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledWith({
      sessionId: 'session-1',
      startedAt: START,
      deepLink: 'kiroku://drinking-session/session-1/live',
      name: 'Friday evening',
      unitsText: '2 units',
      drinkCount: 2,
      drinksLabel: 'Drinks',
      channelName: 'Live session',
    });
  });

  it('carries no auto-close time when the environment has none configured', () => {
    sync(session({a: entry('beer', 1, START)}));
    expect(mockStart).toHaveBeenCalledWith(
      expect.not.objectContaining({autoCloseAt: expect.anything() as unknown}),
    );
  });

  it('times the Android notification out from the last drink, not the start', () => {
    const lastDrink = START + 3 * HOUR_MS;
    sync(session({a: entry('beer', 1, lastDrink)}), {defaultHours: 24});
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({autoCloseAt: lastDrink + 24 * HOUR_MS}),
    );
  });

  it('lets a per-user opt-out drop the auto-close time', () => {
    sync(session({a: entry('beer', 1, START)}), {
      preference: 'never',
      defaultHours: 24,
    });
    expect(mockStart).toHaveBeenCalledWith(
      expect.not.objectContaining({autoCloseAt: expect.anything() as unknown}),
    );
  });

  it('lets a per-user threshold win over the global default', () => {
    sync(session({a: entry('beer', 1, START)}), {
      preference: 6,
      defaultHours: 24,
    });
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({autoCloseAt: START + 6 * HOUR_MS}),
    );
  });

  it('updates on a new drink instead of restarting', () => {
    sync(session({a: entry('beer', 2, START)}));
    jest.clearAllMocks();
    sync(session({a: entry('beer', 2, START), b: entry('wine', 1, START + 1)}));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({unitsText: '4 units', drinkCount: 3}),
    );
  });

  it('sends nothing when nothing the lock screen shows changed', () => {
    const entries = {a: entry('beer', 2, START)};
    sync(session(entries));
    jest.clearAllMocks();
    sync(session({...entries}));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it('carries a rename through as an update', () => {
    sync(session({a: entry('beer', 1, START)}));
    jest.clearAllMocks();
    sync({...session({a: entry('beer', 1, START)}), name: 'Pub quiz'});
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({name: 'Pub quiz'}),
    );
  });

  it('ends with the last numbers and a close time when the session goes', () => {
    sync(session({a: entry('beer', 3, START)}));
    jest.clearAllMocks();
    sync(undefined);
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        unitsText: '3 units',
        drinkCount: 3,
        endedAt: expect.any(Number) as number,
      }),
    );
  });

  it('treats a session that is no longer ongoing as ended', () => {
    sync(session({a: entry('beer', 1, START)}));
    jest.clearAllMocks();
    sync({...session({a: entry('beer', 1, START)}), ongoing: false});
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it('restarts when a different session goes live', () => {
    sync(session({a: entry('beer', 1, START)}));
    jest.clearAllMocks();
    sync({...session({a: entry('beer', 1, START)}), id: 'session-2'});
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({sessionId: 'session-2'}),
    );
  });

  it('clears the lock screen on stop', () => {
    sync(session({a: entry('beer', 1, START)}));
    jest.clearAllMocks();
    LiveActivity.stop();
    expect(mockEnd).toHaveBeenCalledTimes(1);
    // And forgets, so the next sign-in starts from nothing.
    jest.clearAllMocks();
    sync(session({a: entry('beer', 1, START)}));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
});

describe('LiveActivity push token', () => {
  beforeEach(() => {
    LiveActivity.reset();
    jest.clearAllMocks();
  });

  it('registers a token with the device registry when iOS mints one', async () => {
    LiveActivity.watchPushToken();
    emitPushToken('session-1', 'abc123');
    await Promise.resolve();
    expect(mockApiWrite).toHaveBeenCalledWith('RegisterLiveActivity', {
      deviceID: 'device-1',
      sessionId: 'session-1',
      token: 'abc123',
    });
  });

  it('re-registers when iOS rotates the token', async () => {
    LiveActivity.watchPushToken();
    emitPushToken('session-1', 'abc123');
    await Promise.resolve();
    emitPushToken('session-1', 'def456');
    await Promise.resolve();
    expect(mockApiWrite).toHaveBeenCalledTimes(2);
    expect(mockApiWrite).toHaveBeenLastCalledWith(
      'RegisterLiveActivity',
      expect.objectContaining({token: 'def456'}),
    );
  });

  it('clears the registration when the session ends', async () => {
    LiveActivity.watchPushToken();
    sync(session({a: entry('beer', 1, START)}));
    emitPushToken('session-1', 'abc123');
    await Promise.resolve();
    jest.clearAllMocks();

    sync(undefined);
    await Promise.resolve();
    expect(mockApiWrite).toHaveBeenCalledWith('UnregisterLiveActivity', {
      deviceID: 'device-1',
    });
  });

  it('does not clear a registration it never made', async () => {
    // Android: the ongoing notification is local, so no token is ever minted
    // and there is nothing on the server to forget.
    sync(session({a: entry('beer', 1, START)}));
    sync(undefined);
    await Promise.resolve();
    expect(mockApiWrite).not.toHaveBeenCalled();
  });

  it('stops listening when the subscription is torn down', () => {
    const nativeUnsubscribe = jest.fn();
    mockSubscribe.mockReturnValueOnce(nativeUnsubscribe);
    const unsubscribe = LiveActivity.watchPushToken();
    unsubscribe();
    expect(nativeUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
