/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */

/**
 * Pre-launch security audit, Finding 1.1: sign-out must purge the previous
 * user's data from the on-device Onyx store instead of leaking it across an
 * account switch on the same device (and account deletion, which runs this same
 * `cleanupSession` path via CloseAccount). The fix inverts the model:
 * `cleanupSession()` calls `Onyx.clear(KEYS_TO_PRESERVE)`, so every per-user key
 * is cleared BY DEFAULT and only a minimal device-/build-level allowlist
 * survives. A key added later is therefore cleared-by-default, not
 * leaked-by-default.
 *
 * These tests pin:
 *  - the wiring: `cleanupSession` purges through a single
 *    `Onyx.clear(KEYS_TO_PRESERVE)` and never falls back to a per-key denylist
 *    (no stray `Onyx.set(piiKey, null)`), while still tearing down the realtime
 *    socket, the request queue, and timing data;
 *  - the allowlist: `KEYS_TO_PRESERVE` keeps the device/UI keys and EXCLUDES
 *    every sensitive key the audit flagged — which, under `Onyx.clear`'s
 *    "clear everything except the preserved keys" contract, is exactly what
 *    guarantees those keys are wiped.
 */
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import {KEYS_TO_PRESERVE} from '@userActions/App';
import * as Session from '@userActions/Session';
import * as PersistedRequests from '@userActions/PersistedRequests';
import * as Pusher from '@libs/Pusher/pusher';
import Timing from '@userActions/Timing';

// This project's jest.config overrides `setupFiles`, which drops the RN preset's
// AppState mock, so importing the real App.ts (for the real KEYS_TO_PRESERVE)
// hits `AppState.addEventListener` at module load. Shim only AppState via a Proxy
// and pass every other react-native export through untouched (CONST etc. read
// Platform/Dimensions from the real jest-expo mock).
jest.mock('react-native', () => {
  const ReactNative =
    jest.requireActual<Record<PropertyKey, unknown>>('react-native');
  return new Proxy(ReactNative, {
    get: (target, prop) =>
      prop === 'AppState'
        ? {addEventListener: jest.fn(() => ({remove: jest.fn()}))}
        : target[prop],
  });
});

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    clear: jest.fn(() => Promise.resolve()),
    set: jest.fn(() => Promise.resolve()),
    merge: jest.fn(() => Promise.resolve()),
    METHOD: {MERGE: 'merge', SET: 'set'},
  },
  useOnyx: jest.fn(),
}));

// App.ts (imported for KEYS_TO_PRESERVE) pulls the API/navigation graph; stub the
// heavy edges so importing it stays inert under jest.
jest.mock('@libs/API', () => ({
  write: jest.fn(),
  read: jest.fn(),
  makeRequestWithSideEffects: jest.fn(),
}));
jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {
    isNavigationReady: jest.fn(() => Promise.resolve()),
    setParams: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn(),
    waitForProtectedRoutes: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@libs/Navigation/navigationRef', () => ({
  __esModule: true,
  default: {current: null},
}));
jest.mock('@libs/Navigation/currentUrl', () => ({
  __esModule: true,
  default: jest.fn(() => ''),
}));
jest.mock('@libs/setCalendarLocale', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Session.ts side-effect collaborators — assert on `Pusher.disconnect` and
// `PersistedRequests.clear`; the rest just need to exist.
jest.mock('@libs/Pusher/pusher', () => ({disconnect: jest.fn()}));
jest.mock('@libs/Timers', () => ({
  __esModule: true,
  default: {clearAll: jest.fn()},
}));
jest.mock('@userActions/PersistedRequests', () => ({clear: jest.fn()}));
jest.mock('@userActions/Subscriptions', () => ({
  forget: jest.fn(),
  identify: jest.fn(),
  initialize: jest.fn(),
}));
jest.mock('@userActions/Timing', () => ({
  __esModule: true,
  default: {clearData: jest.fn(), start: jest.fn(), end: jest.fn()},
}));
jest.mock('@libs/ErrorUtils', () => ({
  raiseAppError: jest.fn(),
  getMicroSecondOnyxError: jest.fn(),
}));
jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    hmmm: jest.fn(),
    alert: jest.fn(),
  },
}));
jest.mock('@userActions/Session/clearCache', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/auth', () => ({signOut: jest.fn(() => Promise.resolve())}));

describe('Session.cleanupSession – Onyx purge wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('purges the store with a single Onyx.clear(KEYS_TO_PRESERVE)', () => {
    Session.cleanupSession();

    expect(Onyx.clear).toHaveBeenCalledTimes(1);
    expect(jest.mocked(Onyx.clear).mock.calls[0][0]).toEqual(KEYS_TO_PRESERVE);
  });

  it('does NOT fall back to a per-key denylist (no stray Onyx.set)', () => {
    // The whole point of the inversion: clearing is by-default, so there must be
    // no hand-maintained `Onyx.set(key, null)` calls that a future key could slip
    // past.
    Session.cleanupSession();

    // eslint-disable-next-line rulesdir/prefer-actions-set-data -- asserting the action does NOT touch Onyx.set; this is a negative assertion, not a write site
    expect(Onyx.set).not.toHaveBeenCalled();
  });

  it('still tears down the socket, request queue, and timing data', () => {
    Session.cleanupSession();

    expect(Pusher.disconnect).toHaveBeenCalledTimes(1);
    expect(PersistedRequests.clear).toHaveBeenCalledTimes(1);
    expect(Timing.clearData).toHaveBeenCalledTimes(1);
  });
});

describe('KEYS_TO_PRESERVE allowlist', () => {
  it('keeps only the non-sensitive device/build/UI keys', () => {
    expect(KEYS_TO_PRESERVE).toEqual(
      expect.arrayContaining([
        ONYXKEYS.DEVICE_ID,
        ONYXKEYS.NETWORK,
        ONYXKEYS.PREFERRED_THEME,
        ONYXKEYS.NVP_PREFERRED_LOCALE,
        ONYXKEYS.IS_BETA,
      ]),
    );
  });

  it('excludes every sensitive / per-user key so they are cleared by default', () => {
    // Single-value PII + per-user state flagged by the audit, plus the auth keys
    // (Kiroku auth is Firebase-gated, so SESSION/CREDENTIALS are pure leak
    // surface) and the bootstrap flag that must reset between accounts.
    const mustBeCleared = [
      ONYXKEYS.USER_LOCATION,
      ONYXKEYS.USER_PRIVATE_DATA,
      ONYXKEYS.DATA_VISIBILITY,
      ONYXKEYS.PREFERENCES,
      ONYXKEYS.USER,
      ONYXKEYS.USER_DATA_LIST,
      ONYXKEYS.CACHED_DRINKING_SESSIONS,
      ONYXKEYS.FEEDBACK_LIST,
      ONYXKEYS.BUG_LIST,
      ONYXKEYS.SESSION,
      ONYXKEYS.CREDENTIALS,
      ONYXKEYS.IS_LOADING_APP,
      // app/open's "user record delivered" proof (#1435): must not survive a
      // sign-out, or a returning user could be dropped into onboarding.
      ONYXKEYS.USER_DATA_HYDRATED,
      ONYXKEYS.NVP_ONBOARDING,
      ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION,
      ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
      // Collection prefixes — Onyx.clear wipes their member keys too.
      ONYXKEYS.COLLECTION.DRINKING_SESSION,
      ONYXKEYS.COLLECTION.DRINKS,
      ONYXKEYS.COLLECTION.SESSION_LOCATIONS,
    ];

    mustBeCleared.forEach(key => {
      expect(KEYS_TO_PRESERVE).not.toContain(key);
    });
  });
});
