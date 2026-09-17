/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds/asserts Onyx directly to model the queue and the local buffers */

/**
 * The solo session write path on ops (Sessions v2 RFC §5.6), end to end
 * through the real pipeline: `actions/DrinkingSession` -> `SessionOps` ->
 * `API.write` -> `SequentialQueue` -> `PersistedRequests` -> middleware, with
 * only the HTTP layer stubbed.
 *
 * What this pins down:
 *  - starting, logging, editing, removing and saving a session emits ops, and
 *    never a whole-session `UpdateSession` write,
 *  - every logged drink is an entry with an id and a source,
 *  - the app being killed mid-session loses nothing: the ops are already in the
 *    persisted queue and drain on the next launch,
 *  - an offline burst drains in order on reconnect,
 *  - a permission refusal (460) drops the op and rolls its change back, while
 *    a network failure keeps it queued,
 *  - with `SESSION_OPS` off, and for a legacy session with it on, the whole
 *    session write path is unchanged.
 */
import Onyx from 'react-native-onyx';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as PersistedRequests from '@userActions/PersistedRequests';
import * as DS from '@userActions/DrinkingSession';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSession} from '@src/types/onyx';
import type OnyxRequest from '@src/types/onyx/Request';

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

let mockFlags: Record<string, boolean> = {};
jest.mock('@libs/FeatureFlags', () => ({
  isEnabled: (flag: string) => !!mockFlags[flag],
}));

const UID = 'uid-A';
jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({currentUser: {uid: 'uid-A'}}),
}));

jest.mock('@libs/ActiveClientManager', () => ({
  isClientTheLeader: () => true,
  isReady: () => true,
}));

jest.mock('@libs/Pusher/pusher', () => ({getPusherSocketID: () => ''}));

jest.mock('@react-native-community/netinfo', () =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);

// `mock`-prefixed so the jest module factory may reference it.
let mockPushIdCounter = 0;
jest.mock('@libs/generatePushID', () => ({
  __esModule: true,
  default: () => {
    mockPushIdCounter += 1;
    return `-Nid${mockPushIdCounter}`;
  },
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
}));

jest.mock('@libs/Localize', () => ({
  translateLocal: (key: string) => key,
  translate: (_locale: string, key: string) => key,
}));

// The live persist debounce is a timer on the snapshot path; the op path has
// none. Running interactions synchronously keeps the legacy comparison cases
// deterministic.
jest.mock('react-native/Libraries/Interaction/InteractionManager', () => ({
  runAfterInteractions: (task: () => void) => {
    task();
    return {cancel: () => {}};
  },
}));

jest.setTimeout(30000);

const SESSION_ID = '-Nsession1';
const START = 1_700_000_000_000;
const DRINKS_TO_UNITS = {
  small_beer: 0.5,
  beer: 1,
  cocktail: 1.5,
  other: 1,
  strong_shot: 1,
  weak_shot: 0.5,
  wine: 1,
};

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
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

/** Every session op that reached the HTTP layer, in order. */
function sentOps(): Array<Record<string, unknown>> {
  return mockXhr.mock.calls
    .filter(([command]) => command === WRITE_COMMANDS.SESSION_OP)
    .map(([, data]: [string, Record<string, unknown>]) => data);
}

/** Whole-session writes that reached the HTTP layer. */
function sentSessionUpserts(): Array<Record<string, unknown>> {
  return mockXhr.mock.calls
    .filter(([command]) => command === WRITE_COMMANDS.UPDATE_SESSION)
    .map(([, data]: [string, Record<string, unknown>]) => data);
}

function queuedOps(): OnyxRequest[] {
  return PersistedRequests.getAll().filter(
    request => request.command === WRITE_COMMANDS.SESSION_OP,
  );
}

const opTypes = () => sentOps().map(op => op.type);
const queuedOpTypes = () =>
  queuedOps().map(request => (request.data as {type?: string})?.type);

function okResponse(): Promise<unknown> {
  return Promise.resolve({jsonCode: 200, onyxData: []});
}

/** A live schema 2 session as the op path writes it. */
function liveSession(
  overrides: Partial<DrinkingSession> = {},
): DrinkingSession {
  return {
    id: SESSION_ID,
    schema_version: CONST.SESSION.SCHEMA_VERSION,
    name: 'Friday evening',
    visibility: CONST.SESSION.VISIBILITY.FRIENDS,
    start_time: START,
    end_time: START,
    blackout: false,
    note: '',
    timezone: 'Europe/Prague',
    type: CONST.SESSION.TYPES.LIVE,
    ongoing: true,
    ...overrides,
  };
}

/** Seed the live session into the buffer and the cached snapshot. */
async function seedLiveSession(
  session: DrinkingSession = liveSession(),
): Promise<void> {
  DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, session);
  await Onyx.multiSet({
    [ONYXKEYS.ONGOING_SESSION_DATA]: session,
    [ONYXKEYS.CACHED_DRINKING_SESSIONS]: {[UID]: {[SESSION_ID]: session}},
  });
  await settle();
}

/**
 * The live session as the app reads it: `DSUtils.getDrinkingSessionData` is
 * the accessor every session screen goes through, and it is fed by Onyx, so
 * this sees an op's optimistic patch and its rollback exactly as the UI does.
 */
async function readBuffer(): Promise<DrinkingSession | undefined> {
  await settle();
  return DSUtils.getDrinkingSessionData(SESSION_ID);
}

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
  mockFlags = {SESSION_OPS: true, SESSIONS_V2_SCHEMA: true};
  mockPushIdCounter = 0;
  mockXhr.mockReset();
  mockXhr.mockImplementation(() => okResponse());
  SequentialQueue.resetQueue();
  DSUtils.clearOngoingSessionCache();
  await Onyx.clear();
  await Onyx.multiSet({
    [ONYXKEYS.SESSION]: {authToken: 'tok'},
    [ONYXKEYS.CREDENTIALS]: {},
    [ONYXKEYS.PREFERENCES]: {drinks_to_units: DRINKS_TO_UNITS},
  });
  await settle();
});

describe('starting a live session', () => {
  it('sends one start op carrying the new session meta', async () => {
    await DS.startLiveDrinkingSession({uid: UID} as never, 'Europe/Prague');
    await waitFor(() => sentOps().length === 1);

    expect(sentSessionUpserts()).toHaveLength(0);
    const op = sentOps().at(0);
    expect(op?.type).toBe(CONST.SESSION_OP.TYPE.START);
    expect(op?.payload).toMatchObject({
      type: CONST.SESSION.TYPES.LIVE,
      timezone: 'Europe/Prague',
      visibility: CONST.SESSION.VISIBILITY.FRIENDS,
      start_time: expect.any(Number) as number,
    });
    // The op id doubles as the idempotency key, so a replay is answered from
    // its record rather than starting the session twice.
    expect(op?.idempotencyKey).toBe(op?.opId);
  });

  it('still writes the whole session when SESSION_OPS is off', async () => {
    mockFlags = {SESSION_OPS: false, SESSIONS_V2_SCHEMA: true};
    await DS.startLiveDrinkingSession({uid: UID} as never, 'Europe/Prague');
    await waitFor(() => sentSessionUpserts().length === 1);
    expect(sentOps()).toHaveLength(0);
  });

  it('still writes the whole session when the schema flag is off', async () => {
    // Without schema 2 the session has no `entries`, so there is nothing an op
    // could name and the server would refuse one.
    mockFlags = {SESSION_OPS: true, SESSIONS_V2_SCHEMA: false};
    await DS.startLiveDrinkingSession({uid: UID} as never, 'Europe/Prague');
    await waitFor(() => sentSessionUpserts().length === 1);
    expect(sentOps()).toHaveLength(0);
  });
});

describe('logging drinks', () => {
  it('sends add_entry with an id and a source, and shows the drink at once', async () => {
    await seedLiveSession();
    DS.updateDrinks(
      SESSION_ID,
      'beer',
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await waitFor(() => sentOps().length === 1);

    const op = sentOps().at(0);
    expect(op?.type).toBe(CONST.SESSION_OP.TYPE.ADD_ENTRY);
    expect(op?.payload).toMatchObject({
      entryId: expect.any(String) as string,
      key: 'beer',
      count: 1,
      source: CONST.SESSION.ENTRY_SOURCE.PHONE,
      ts: expect.any(Number) as number,
    });
    expect(sentSessionUpserts()).toHaveLength(0);

    const buffer = await readBuffer();
    const entries = Object.entries(buffer?.entries ?? {});
    expect(entries).toHaveLength(1);
    expect(entries[0][1]).toMatchObject({
      key: 'beer',
      count: 1,
      source: CONST.SESSION.ENTRY_SOURCE.PHONE,
    });
  });

  it('sends one op per tap, each with its own entry id', async () => {
    await seedLiveSession();
    for (let i = 0; i < 3; i++) {
      DS.updateDrinks(
        SESSION_ID,
        'beer',
        1,
        CONST.DRINKS.ACTIONS.ADD,
        DRINKS_TO_UNITS,
      );
    }
    await waitFor(() => sentOps().length === 3);

    const ids = sentOps().map(op => (op.payload as {entryId: string}).entryId);
    expect(new Set(ids).size).toBe(3);
  });

  it('removes a drink as delete_entry, keeping the key as a tombstone', async () => {
    await seedLiveSession(
      liveSession({
        entries: {
          e1: {
            ts: START,
            key: 'beer',
            count: 1,
            source: CONST.SESSION.ENTRY_SOURCE.PHONE,
            author_uid: UID,
            target_uid: UID,
            created_at: START,
          },
        },
      }),
    );
    DS.updateDrinks(
      SESSION_ID,
      'beer',
      1,
      CONST.DRINKS.ACTIONS.REMOVE,
      DRINKS_TO_UNITS,
    );
    await waitFor(() => sentOps().length === 1);

    expect(sentOps().at(0)).toMatchObject({
      type: CONST.SESSION_OP.TYPE.DELETE_ENTRY,
      payload: {entryId: 'e1'},
    });
    const buffer = await readBuffer();
    expect(buffer?.entries?.e1?.deleted).toBe(true);
  });

  it('removes part of an entry as edit_entry, keeping its id', async () => {
    await seedLiveSession(
      liveSession({
        entries: {
          e1: {
            ts: START,
            key: 'beer',
            count: 3,
            source: CONST.SESSION.ENTRY_SOURCE.PHONE,
            author_uid: UID,
            target_uid: UID,
            created_at: START,
          },
        },
      }),
    );
    DS.updateDrinks(
      SESSION_ID,
      'beer',
      1,
      CONST.DRINKS.ACTIONS.REMOVE,
      DRINKS_TO_UNITS,
    );
    await waitFor(() => sentOps().length === 1);

    expect(sentOps().at(0)).toMatchObject({
      type: CONST.SESSION_OP.TYPE.EDIT_ENTRY,
      payload: {entryId: 'e1', count: 2},
    });
  });

  it('keeps a legacy session on the whole-session path even with ops on', async () => {
    const legacy: DrinkingSession = {
      id: SESSION_ID,
      start_time: START,
      end_time: START,
      blackout: false,
      note: '',
      timezone: 'Europe/Prague',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: true,
      drinks: {[START]: {beer: 1}},
    };
    await seedLiveSession(legacy);
    DS.updateDrinks(
      SESSION_ID,
      'beer',
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await waitFor(() => sentSessionUpserts().length === 1);
    expect(sentOps()).toHaveLength(0);
  });
});

describe('deleting a named entry', () => {
  const twoBeers = () =>
    liveSession({
      entries: {
        older: {
          ts: START,
          key: 'beer',
          count: 3,
          source: CONST.SESSION.ENTRY_SOURCE.PHONE,
          author_uid: UID,
          target_uid: UID,
          created_at: START,
        },
        newer: {
          ts: START + 60_000,
          key: 'beer',
          count: 1,
          source: CONST.SESSION.ENTRY_SOURCE.PHONE,
          author_uid: UID,
          target_uid: UID,
          created_at: START,
        },
      },
    });

  it('deletes the entry the user pointed at, not the newest one', async () => {
    await seedLiveSession(twoBeers());
    DS.removeSessionEntry(SESSION_ID, 'older');
    await waitFor(() => sentOps().length === 1);

    // "Remove from latest" would have taken `newer`. This names `older`.
    expect(sentOps().at(0)).toMatchObject({
      type: CONST.SESSION_OP.TYPE.DELETE_ENTRY,
      payload: {entryId: 'older'},
    });
    const buffer = await readBuffer();
    expect(buffer?.entries?.older?.deleted).toBe(true);
    // The key stays, and its neighbour is untouched.
    expect(buffer?.entries?.older?.count).toBe(3);
    expect(buffer?.entries?.newer?.deleted).toBeUndefined();
  });

  it('sends nothing when the entry is already a tombstone', async () => {
    const session = twoBeers();
    const entries = session.entries ?? {};
    await seedLiveSession({
      ...session,
      entries: {...entries, older: {...entries.older, deleted: true}},
    });
    DS.removeSessionEntry(SESSION_ID, 'older');
    await settle();
    expect(sentOps()).toHaveLength(0);
  });

  it('sends nothing for an id the session does not have', async () => {
    await seedLiveSession(twoBeers());
    DS.removeSessionEntry(SESSION_ID, 'nope');
    await settle();
    expect(sentOps()).toHaveLength(0);
  });

  it('refuses a legacy session, which has no entry ids to name', async () => {
    await seedLiveSession({
      id: SESSION_ID,
      start_time: START,
      end_time: START,
      blackout: false,
      note: '',
      timezone: 'Europe/Prague',
      type: CONST.SESSION.TYPES.LIVE,
      ongoing: true,
      drinks: {[START]: {beer: 1}},
    });
    DS.removeSessionEntry(SESSION_ID, 'whatever');
    await settle();
    expect(sentOps()).toHaveLength(0);
    expect(sentSessionUpserts()).toHaveLength(0);
  });

  it('two devices deleting different drinks cannot touch each other', async () => {
    // The race the bucket path could not survive: each delete names its own
    // key, so the two writes are disjoint whichever order the server sees.
    await seedLiveSession(twoBeers());
    DS.removeSessionEntry(SESSION_ID, 'older');
    DS.removeSessionEntry(SESSION_ID, 'newer');
    await waitFor(() => sentOps().length === 2);

    expect(
      sentOps().map(op => (op.payload as {entryId: string}).entryId),
    ).toEqual(['older', 'newer']);
    const buffer = await readBuffer();
    expect(buffer?.entries?.older?.deleted).toBe(true);
    expect(buffer?.entries?.newer?.deleted).toBe(true);
  });
});

describe('session meta while live', () => {
  it('sends set_note and set_blackout', async () => {
    await seedLiveSession();
    DS.updateNote(liveSession(), 'a good night');
    await waitFor(() => sentOps().length === 1);
    DS.updateBlackout(liveSession(), true);
    await waitFor(() => sentOps().length === 2);

    expect(sentOps().at(0)).toMatchObject({
      type: CONST.SESSION_OP.TYPE.SET_NOTE,
      payload: {note: 'a good night'},
    });
    expect(sentOps().at(1)).toMatchObject({
      type: CONST.SESSION_OP.TYPE.SET_BLACKOUT,
      payload: {blackout: true},
    });
    expect(sentSessionUpserts()).toHaveLength(0);
  });

  it('sends the timezone on set_times, leaving the times as they are', async () => {
    await seedLiveSession();
    DS.updateTimezone(liveSession(), 'Asia/Tokyo');
    await waitFor(() => sentOps().length === 1);

    expect(sentOps().at(0)).toMatchObject({
      type: CONST.SESSION_OP.TYPE.SET_TIMES,
      payload: {start_time: START, end_time: START, timezone: 'Asia/Tokyo'},
    });
  });

  it('shifts a live session to another date as absolute times, never a delta', async () => {
    const session = liveSession({
      entries: {
        e1: {
          ts: START,
          key: 'beer',
          count: 1,
          source: CONST.SESSION.ENTRY_SOURCE.PHONE,
          author_uid: UID,
          target_uid: UID,
          created_at: START,
        },
      },
    });
    await seedLiveSession(session);
    await DS.updateSessionDate(
      SESSION_ID,
      session,
      new Date(START - 86_400_000),
      true,
    );
    await waitFor(() => sentOps().length === 2);

    expect(opTypes()).toEqual([
      CONST.SESSION_OP.TYPE.SET_TIMES,
      CONST.SESSION_OP.TYPE.EDIT_ENTRY,
    ]);
    // Absolute: a replay of either op lands the session on the same day rather
    // than shifting it a second time.
    const setTimes = sentOps().at(0)?.payload as {start_time: number};
    expect(setTimes.start_time).toBe(START - 86_400_000);
    const edit = sentOps().at(1)?.payload as {entryId: string; ts: number};
    expect(edit).toMatchObject({entryId: 'e1', ts: START - 86_400_000});
  });
});

describe('saving a session', () => {
  it('ends a live session with one end op, and no whole-session write', async () => {
    const session = liveSession({
      entries: {
        e1: {
          ts: START,
          key: 'beer',
          count: 1,
          source: CONST.SESSION.ENTRY_SOURCE.PHONE,
          author_uid: UID,
          target_uid: UID,
          created_at: START,
        },
      },
    });
    await seedLiveSession(session);
    await DS.saveDrinkingSessionData(
      UID,
      {...session, ongoing: false, end_time: START + 3_600_000},
      SESSION_ID,
      ONYXKEYS.ONGOING_SESSION_DATA,
      true,
    );
    await waitFor(() => sentOps().length >= 1);
    await settle();

    expect(opTypes()).toEqual([
      CONST.SESSION_OP.TYPE.SET_TIMES,
      CONST.SESSION_OP.TYPE.END,
    ]);
    expect(sentOps().at(-1)?.payload).toEqual({end_time: START + 3_600_000});
    expect(sentSessionUpserts()).toHaveLength(0);
  });

  it('turns a brand new edit session into start plus one add per drink', async () => {
    const edited: DrinkingSession = {
      id: SESSION_ID,
      schema_version: CONST.SESSION.SCHEMA_VERSION,
      name: 'Friday evening',
      visibility: CONST.SESSION.VISIBILITY.FRIENDS,
      start_time: START,
      end_time: START + 1000,
      blackout: false,
      note: 'brunch',
      timezone: 'Europe/Prague',
      type: CONST.SESSION.TYPES.EDIT,
      ongoing: false,
      entries: {
        e1: {
          ts: START,
          key: 'beer',
          count: 1,
          source: CONST.SESSION.ENTRY_SOURCE.PHONE,
          author_uid: UID,
          target_uid: UID,
          created_at: START,
        },
        e2: {
          ts: START + 500,
          key: 'wine',
          count: 2,
          source: CONST.SESSION.ENTRY_SOURCE.PHONE,
          author_uid: UID,
          target_uid: UID,
          created_at: START,
        },
      },
    };
    await DS.saveDrinkingSessionData(
      UID,
      edited,
      SESSION_ID,
      ONYXKEYS.EDIT_SESSION_DATA,
      false,
    );
    await waitFor(() => sentOps().length === 3);

    expect(opTypes()).toEqual([
      CONST.SESSION_OP.TYPE.START,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
    ]);
    // `start` stamps `ongoing` from the type, so an edit session needs no end.
    expect(opTypes()).not.toContain(CONST.SESSION_OP.TYPE.END);
    expect(sentOps().at(0)?.payload).toMatchObject({
      type: CONST.SESSION.TYPES.EDIT,
      note: 'brunch',
    });
  });

  it('diffs an existing edit session into only the ops that changed', async () => {
    const stored = liveSession({
      ongoing: false,
      type: CONST.SESSION.TYPES.EDIT,
      entries: {
        e1: {
          ts: START,
          key: 'beer',
          count: 1,
          source: CONST.SESSION.ENTRY_SOURCE.PHONE,
          author_uid: UID,
          target_uid: UID,
          created_at: START,
        },
      },
    });
    await Onyx.set(ONYXKEYS.CACHED_DRINKING_SESSIONS, {
      [UID]: {[SESSION_ID]: stored},
    });
    await settle();

    await DS.saveDrinkingSessionData(
      UID,
      {
        ...stored,
        note: 'changed',
        entries: {
          ...stored.entries,
          e2: {
            ts: START + 60_000,
            key: 'wine',
            count: 1,
            source: CONST.SESSION.ENTRY_SOURCE.PHONE,
            author_uid: UID,
            target_uid: UID,
            created_at: START,
          },
        },
      },
      SESSION_ID,
      ONYXKEYS.EDIT_SESSION_DATA,
      false,
    );
    await waitFor(() => sentOps().length === 2);

    expect(opTypes()).toEqual([
      CONST.SESSION_OP.TYPE.SET_NOTE,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
    ]);
  });
});

describe('offline and restart durability', () => {
  it('keeps an offline burst queued and drains it in order on reconnect', async () => {
    await seedLiveSession();
    await setNetwork(true);

    for (let i = 0; i < 4; i++) {
      DS.updateDrinks(
        SESSION_ID,
        'beer',
        1,
        CONST.DRINKS.ACTIONS.ADD,
        DRINKS_TO_UNITS,
      );
    }
    DS.updateNote(liveSession(), 'offline note');
    await settle();

    // Nothing left the device, and every op is on disk (in the persisted
    // queue), not behind a debounce timer.
    expect(sentOps()).toHaveLength(0);
    expect(queuedOpTypes()).toEqual([
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.SET_NOTE,
    ]);
    // All four drinks are already visible locally.
    const buffer = await readBuffer();
    expect(Object.keys(buffer?.entries ?? {})).toHaveLength(4);

    await setNetwork(false);
    await waitFor(() => PersistedRequests.getAll().length === 0);

    expect(opTypes()).toEqual([
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.SET_NOTE,
    ]);
    // Four distinct entry ids reached the server: no drink was coalesced away.
    const ids = sentOps()
      .filter(op => op.type === CONST.SESSION_OP.TYPE.ADD_ENTRY)
      .map(op => (op.payload as {entryId: string}).entryId);
    expect(new Set(ids).size).toBe(4);
  });

  it('loses nothing when the app is killed mid-session', async () => {
    await seedLiveSession();
    await setNetwork(true);
    DS.updateDrinks(
      SESSION_ID,
      'beer',
      2,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    DS.updateDrinks(
      SESSION_ID,
      'wine',
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await settle();
    expect(queuedOps()).toHaveLength(2);

    // The kill: drop every in-memory cache the way a cold start would, leaving
    // only what Onyx persisted (the queue and the live buffer). No timer
    // survives this, which is exactly why the snapshot path needed sync stamps
    // and the op path does not.
    SequentialQueue.resetQueue();
    DSUtils.clearOngoingSessionCache();
    await settle();
    expect(queuedOps()).toHaveLength(2);

    await setNetwork(false);
    SequentialQueue.flush();
    await waitFor(() => PersistedRequests.getAll().length === 0);

    expect(opTypes()).toEqual([
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
      CONST.SESSION_OP.TYPE.ADD_ENTRY,
    ]);
    expect(
      sentOps().map(op => op.payload as {key: string; count: number}),
    ).toEqual([
      expect.objectContaining({key: 'beer', count: 2}),
      expect.objectContaining({key: 'wine', count: 1}),
    ]);
  });
});

describe('failure paths', () => {
  it('rolls a permission refusal (460) back and drops it from the queue', async () => {
    await seedLiveSession();
    mockXhr.mockImplementation((command: string) => {
      if (command !== WRITE_COMMANDS.SESSION_OP) {
        return okResponse();
      }
      // Answered after a beat, so the optimistic state is observable before
      // the refusal rolls it back.
      return new Promise((_resolve, reject) => {
        setTimeout(
          () =>
            reject(
              Object.assign(new Error('Permission denied'), {
                status: String(CONST.HTTP_STATUS.PERMISSION_DENIED),
              }),
            ),
          50,
        );
      });
    });

    DS.updateDrinks(
      SESSION_ID,
      'beer',
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await settle();
    // The drink shows immediately, while the op is still in flight.
    expect(Object.keys((await readBuffer())?.entries ?? {})).toHaveLength(1);

    await waitFor(() => PersistedRequests.getAll().length === 0);
    await settle();

    // A permission refusal is deterministic, so the op is dropped rather than
    // retried forever, and its failure data takes the drink back out.
    expect(await readBuffer()).toMatchObject({entries: {}});
    expect(sentOps()).toHaveLength(1);
  });

  it('keeps an op queued when the failure is the network, not the server', async () => {
    await seedLiveSession();
    mockXhr.mockImplementation((command: string) => {
      if (command !== WRITE_COMMANDS.SESSION_OP) {
        return okResponse();
      }
      // No status at all: a fetch failure, which may well deliver later.
      return Promise.reject(new Error('Failed to fetch'));
    });

    DS.updateDrinks(
      SESSION_ID,
      'beer',
      1,
      CONST.DRINKS.ACTIONS.ADD,
      DRINKS_TO_UNITS,
    );
    await settle();
    expect(queuedOps()).toHaveLength(1);

    // The drink stays in the buffer: nothing was rolled back, because the
    // write may still land.
    expect(Object.keys((await readBuffer())?.entries ?? {})).toHaveLength(1);
    expect(queuedOps()).toHaveLength(1);
  });
});
