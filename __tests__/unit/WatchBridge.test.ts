/**
 * Tests for the phone-side watch credential bridge wiring
 * (src/libs/WatchBridge/index.ios.ts; jest-expo resolves the .ios fork).
 * react-native and the heavy transitive imports are mocked so the real payload
 * assembly, dedupe, and signed-out paths run against a mock native module.
 */
import type {DrinkingSession} from '@src/types/onyx';

const mockUpdateCredential = jest.fn();
const mockClearCredential = jest.fn();

jest.mock('react-native', () => ({
  NativeModules: {
    WatchBridge: {
      updateCredential: mockUpdateCredential,
      clearCredential: mockClearCredential,
    },
  },
}));

// Without `__esModule` in the factory, babel's CJS interop hands default
// imports the whole mock object, which is exactly the shape these need.
jest.mock('react-native-onyx', () => ({connect: jest.fn()}));

jest.mock('@src/CONST', () => ({
  DEFAULT_TIME_ZONE: {automatic: true, selected: 'UTC'},
  DRINKS: {
    KEYS: {
      SMALL_BEER: 'small_beer',
      BEER: 'beer',
      COCKTAIL: 'cocktail',
      OTHER: 'other',
      STRONG_SHOT: 'strong_shot',
      WEAK_SHOT: 'weak_shot',
      WINE: 'wine',
    },
  },
  SESSION: {
    TYPES: {LIVE: 'live', EDIT: 'edit'},
    SCHEMA_VERSION: 2,
    ENTRY_SOURCE: {PHONE: 'phone'},
  },
}));

jest.mock('@libs/ApiUtils', () => ({
  getKirokuApiEnv: jest.fn(() => 'dev'),
}));

jest.mock('@libs/FeatureFlags', () => ({isEnabled: jest.fn(() => false)}));

jest.mock('@libs/AppStateMonitor', () => ({
  addBecameActiveListener: jest.fn(),
}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: jest.fn(),
}));

jest.mock('@libs/Log', () => ({hmmm: jest.fn()}));

const {getFirebaseAuth} = jest.requireMock<{getFirebaseAuth: jest.Mock}>(
  '@libs/Firebase/FirebaseApp',
);

const EXPIRATION_TIME = '2026-07-08T12:00:00.000Z';
const EXPIRATION_MS = 1783512000000;

type WatchBridgeJsModule = {
  pushCredentialToWatch: () => Promise<void>;
  serializeOngoingSession: (
    session: DrinkingSession | undefined,
  ) => string | undefined;
};

describe('WatchBridge', () => {
  let pushCredentialToWatch: WatchBridgeJsModule['pushCredentialToWatch'];
  let serializeOngoingSession: WatchBridgeJsModule['serializeOngoingSession'];

  beforeEach(() => {
    jest.clearAllMocks();
    // Fresh module instance per test so the dedupe state resets.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const watchBridge = require<WatchBridgeJsModule>('@libs/WatchBridge');
      pushCredentialToWatch = watchBridge.pushCredentialToWatch;
      serializeOngoingSession = watchBridge.serializeOngoingSession;
    });
  });

  const DRINK_TS = 1700000001000;
  const liveSession: DrinkingSession = {
    id: '-Abc123',
    start_time: 1700000000000,
    end_time: 1700000005000,
    timezone: 'Europe/Prague',
    type: 'live',
    ongoing: true,
    drinks: {
      [DRINK_TS]: {beer: 2, wine: {count: 1, volume_ml: 150}},
    },
    drinksTimeParts: {[DRINK_TS]: {year: 2023, month: 11, day: 14}},
  } as unknown as DrinkingSession;

  describe('serializeOngoingSession', () => {
    it('returns undefined when there is no live session to mirror', () => {
      expect(serializeOngoingSession(undefined)).toBeUndefined();
      expect(
        serializeOngoingSession({...liveSession, ongoing: false}),
      ).toBeUndefined();
      expect(
        serializeOngoingSession({...liveSession, id: undefined}),
      ).toBeUndefined();
    });

    it('whitelists wire fields and collapses drink entries to counts', () => {
      const json = serializeOngoingSession(liveSession);
      expect(json).toBeDefined();
      const parsed = JSON.parse(json ?? '') as Record<string, unknown>;
      expect(parsed).toEqual({
        id: '-Abc123',
        start_time: 1700000000000,
        end_time: 1700000005000,
        blackout: false,
        note: '',
        timezone: 'Europe/Prague',
        type: 'live',
        ongoing: true,
        // The object-form wine entry is collapsed to its count; the JS-only
        // drinksTimeParts field must not survive serialization.
        drinks: {[DRINK_TS]: {beer: 2, wine: 1}},
      });
    });

    it('omits drinks entirely when every entry is zero', () => {
      const session = {
        ...liveSession,
        drinks: {[DRINK_TS]: {beer: 0}},
      } as DrinkingSession;
      const parsed = JSON.parse(
        serializeOngoingSession(session) ?? '',
      ) as Record<string, unknown>;
      expect(parsed.drinks).toBeUndefined();
    });

    it('passes a v2 session through with its schema, name, visibility and entries', () => {
      const entries = {
        entryA: {
          ts: DRINK_TS,
          key: 'beer',
          count: 2,
          source: 'phone',
          author_uid: 'uid-42',
          target_uid: 'uid-42',
          created_at: DRINK_TS,
        },
        entryB: {
          ts: DRINK_TS,
          key: 'wine',
          count: 1,
          source: 'phone',
          author_uid: 'uid-42',
          target_uid: 'uid-42',
          created_at: DRINK_TS,
          deleted: true,
        },
      };
      const v2Session = {
        id: '-V2abc',
        schema_version: 2,
        name: 'Friday evening',
        visibility: 'friends',
        start_time: 1700000000000,
        end_time: 1700000005000,
        timezone: 'Europe/Prague',
        type: 'live',
        ongoing: true,
        entries,
        drinksTimeParts: {tz: 'Europe/Prague', byTs: {}},
      } as unknown as DrinkingSession;
      const parsed = JSON.parse(
        serializeOngoingSession(v2Session) ?? '',
      ) as Record<string, unknown>;
      expect(parsed).toEqual({
        id: '-V2abc',
        start_time: 1700000000000,
        end_time: 1700000005000,
        blackout: false,
        note: '',
        timezone: 'Europe/Prague',
        type: 'live',
        ongoing: true,
        schema_version: 2,
        name: 'Friday evening',
        visibility: 'friends',
        // Tombstones travel too: the watch writes the whole session back and
        // an entry key is never removed.
        entries,
      });
      expect(parsed.drinks).toBeUndefined();
    });

    it('fills the fields the watch Codable model requires', () => {
      const minimal = {
        id: '-Min1',
        start_time: 1700000000000,
        ongoing: true,
      } as DrinkingSession;
      const parsed = JSON.parse(
        serializeOngoingSession(minimal) ?? '',
      ) as Record<string, unknown>;
      expect(parsed.end_time).toBe(1700000000000);
      expect(parsed.blackout).toBe(false);
      expect(parsed.note).toBe('');
      expect(parsed.timezone).toBe('UTC');
      expect(parsed.type).toBe('live');
    });
  });

  describe('pushCredentialToWatch', () => {
    const mockSignedInUser = () => {
      getFirebaseAuth.mockReturnValue({
        currentUser: {
          uid: 'uid-42',
          getIdTokenResult: jest.fn().mockResolvedValue({
            token: 'id-token',
            expirationTime: EXPIRATION_TIME,
          }),
        },
      });
    };

    it('pushes the credential with expiresAt converted to epoch ms', async () => {
      mockSignedInUser();
      await pushCredentialToWatch();
      expect(mockUpdateCredential).toHaveBeenCalledTimes(1);
      expect(mockUpdateCredential).toHaveBeenCalledWith({
        idToken: 'id-token',
        uid: 'uid-42',
        expiresAt: EXPIRATION_MS,
        apiEnv: 'dev',
        sessionsV2Schema: false,
      });
      expect(new Date(EXPIRATION_TIME).getTime()).toBe(EXPIRATION_MS);
    });

    it('dedupes identical payloads', async () => {
      mockSignedInUser();
      await pushCredentialToWatch();
      await pushCredentialToWatch();
      expect(mockUpdateCredential).toHaveBeenCalledTimes(1);
    });

    it('clears the credential once when signed out', async () => {
      getFirebaseAuth.mockReturnValue({currentUser: null});
      await pushCredentialToWatch();
      await pushCredentialToWatch();
      expect(mockClearCredential).toHaveBeenCalledTimes(1);
      expect(mockUpdateCredential).not.toHaveBeenCalled();
    });
  });
});
