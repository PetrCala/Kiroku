/**
 * Tests for the lock-screen sync logic (src/libs/actions/LiveActivity.ts):
 * which of start / update / end a change in the ongoing session means, and the
 * payload the native surface is handed. The platform module is mocked, so the
 * real payload assembly and diffing run.
 */
import type {DrinkingSession} from '@src/types/onyx';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {SessionEntry} from '@src/types/onyx/SessionEntries';

jest.mock('@libs/LiveActivity', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __esModule: true,
  // Created inside the factory: it runs while the hoisted imports are still
  // being evaluated, before any const at the top of this file is assigned.
  default: {start: jest.fn(), update: jest.fn(), end: jest.fn()},
}));

// The default name is localized off the device locale, which is not what this
// file is about; a fixed stand-in keeps the payload assertions readable.
jest.mock('@libs/SessionName', () => ({
  getDefaultSessionName: jest.fn(() => 'Friday evening'),
}));

// eslint-disable-next-line import/first
import LiveActivityModule from '@libs/LiveActivity';
// eslint-disable-next-line import/first
import * as LiveActivity from '@userActions/LiveActivity';

const mockStart = LiveActivityModule.start as jest.Mock;
const mockUpdate = LiveActivityModule.update as jest.Mock;
const mockEnd = LiveActivityModule.end as jest.Mock;

const START = 1_700_000_000_000;
const DRINKS_TO_UNITS = {beer: 1, wine: 2} as never;

/** A translate stand-in: keys through, `units` rendered as the app renders it. */
const translate = ((key: string, params?: {unitCount?: number}) => {
  if (key === 'homeScreen.liveSessionCard.units') {
    return `${params?.unitCount ?? 0} units`;
  }
  if (key === 'common.drinks') {
    return 'Drinks';
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

function sync(current: DrinkingSession | undefined) {
  LiveActivity.sync({
    session: current,
    drinksToUnits: DRINKS_TO_UNITS,
    translate,
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
    });
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
