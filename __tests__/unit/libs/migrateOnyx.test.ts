/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- `Onyx.set` is referenced here only to assert on the mock, never to write real data */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */

/**
 * `migrateOnyx` gates the whole navigator: `Kiroku` renders NavigationRoot and
 * the modals behind `isOnyxMigrated`, which flips only when this promise
 * settles. So the contract under test is availability first, correctness
 * second:
 *
 *  - it ALWAYS settles, whatever the migrations do (throw, reject, hang);
 *  - it settles fast, capped by BOOT_SPLASH_MIGRATION_TIMEOUT_MS, which sits
 *    below SplashScreenHider's force-hide net (a splash dissolving over an
 *    unmounted tree is the failure mode this replaces);
 *  - migrations covered by the stored schema version don't re-run, and the
 *    stamp is written only after a full, successful pass, so a failed or
 *    timed-out run is retried on the next launch rather than skipped.
 */
import Onyx from 'react-native-onyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import Log from '@libs/Log';
import migrateOnyx, {LATEST_SCHEMA_VERSION} from '@libs/migrateOnyx';
import DropLegacySessionsCalendarMonthsLoaded from '@libs/migrations/DropLegacySessionsCalendarMonthsLoaded';
import HydrateLegacyDrinkEntries from '@libs/migrations/HydrateLegacyDrinkEntries';

const mockStore = new Map<string, unknown>();

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    // Real Onyx resolves a single-key connect asynchronously and fires the
    // callback even when the key is absent (with `undefined`), which is the
    // "no stored version" path every upgrading install takes.
    connect: jest.fn(
      ({key, callback}: {key: string; callback: (value: unknown) => void}) => {
        Promise.resolve().then(() => callback(mockStore.get(key)));
        return 1;
      },
    ),
    disconnect: jest.fn(),
    set: jest.fn((key: string, value: unknown) => {
      mockStore.set(key, value);
      return Promise.resolve();
    }),
    merge: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {info: jest.fn(), alert: jest.fn()},
}));

jest.mock('@libs/migrations/DropLegacySessionsCalendarMonthsLoaded', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve()),
}));

jest.mock('@libs/migrations/HydrateLegacyDrinkEntries', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve()),
}));

const mockedDrop = jest.mocked(DropLegacySessionsCalendarMonthsLoaded);
const mockedHydrate = jest.mocked(HydrateLegacyDrinkEntries);
const mockedSet = jest.mocked(Onyx.set);
const mockedAlert = jest.mocked(Log.alert);

/** Let queued microtasks (the connect callback, each migration) run. */
const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) {
    // eslint-disable-next-line no-await-in-loop -- sequential drain is the point
    await Promise.resolve();
  }
};

const getStoredVersion = () => mockStore.get(ONYXKEYS.ONYX_SCHEMA_VERSION);

describe('migrateOnyx', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
    mockedDrop.mockImplementation(() => Promise.resolve());
    mockedHydrate.mockImplementation(() => Promise.resolve());
  });

  it('runs every migration on a store with no stored version, then stamps it', async () => {
    await migrateOnyx();

    expect(mockedDrop).toHaveBeenCalledTimes(1);
    expect(mockedHydrate).toHaveBeenCalledTimes(1);
    expect(mockedSet).toHaveBeenCalledWith(
      ONYXKEYS.ONYX_SCHEMA_VERSION,
      LATEST_SCHEMA_VERSION,
    );
    expect(getStoredVersion()).toBe(LATEST_SCHEMA_VERSION);
  });

  it('runs migrations once and skips them on the next launch', async () => {
    await migrateOnyx();
    jest.clearAllMocks();
    await migrateOnyx();

    expect(mockedDrop).not.toHaveBeenCalled();
    expect(mockedHydrate).not.toHaveBeenCalled();
    // Nothing ran, so nothing needs re-stamping.
    expect(mockedSet).not.toHaveBeenCalled();
    expect(getStoredVersion()).toBe(LATEST_SCHEMA_VERSION);
  });

  it('runs only the migrations the stored version does not cover', async () => {
    mockStore.set(ONYXKEYS.ONYX_SCHEMA_VERSION, 1);

    await migrateOnyx();

    expect(mockedDrop).not.toHaveBeenCalled();
    expect(mockedHydrate).toHaveBeenCalledTimes(1);
    expect(getStoredVersion()).toBe(LATEST_SCHEMA_VERSION);
  });

  it('runs migrations in order', async () => {
    const order: string[] = [];
    mockedDrop.mockImplementation(() => {
      order.push('drop');
      return Promise.resolve();
    });
    mockedHydrate.mockImplementation(() => {
      order.push('hydrate');
      return Promise.resolve();
    });

    await migrateOnyx();

    expect(order).toEqual(['drop', 'hydrate']);
  });

  it('still resolves when a migration rejects, and does not stamp the store', async () => {
    mockedDrop.mockImplementation(() => Promise.reject(new Error('boom')));

    await expect(migrateOnyx()).resolves.toBeUndefined();

    // The failure short-circuits the chain and leaves the version unstamped, so
    // the next launch retries from the same point.
    expect(mockedHydrate).not.toHaveBeenCalled();
    expect(getStoredVersion()).toBeUndefined();
    expect(mockedAlert).toHaveBeenCalledWith(
      expect.stringContaining('migration failed'),
      expect.objectContaining({message: 'boom'}),
    );
  });

  it('still resolves when a migration throws synchronously', async () => {
    mockedDrop.mockImplementation(() => {
      throw new Error('sync boom');
    });

    await expect(migrateOnyx()).resolves.toBeUndefined();
    expect(getStoredVersion()).toBeUndefined();
  });

  it('resolves via the timeout when a migration hangs, and does not stamp', async () => {
    // `jest/setupAfterEnv` puts every suite on real timers, so opt in here.
    jest.useFakeTimers();
    try {
      mockedDrop.mockImplementation(() => new Promise<void>(() => {}));

      const promise = migrateOnyx();
      await flushMicrotasks();
      // Nothing can settle it but the timer: the migration never returns.
      jest.advanceTimersByTime(CONST.BOOT_SPLASH_MIGRATION_TIMEOUT_MS);

      await expect(promise).resolves.toBeUndefined();
      expect(mockedAlert).toHaveBeenCalledWith(
        expect.stringContaining('timed out'),
      );
      expect(getStoredVersion()).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('caps the boot well below the splash force-hide net', () => {
    expect(CONST.BOOT_SPLASH_MIGRATION_TIMEOUT_MS).toBeLessThan(
      CONST.BOOT_SPLASH_FORCE_HIDE_TIMEOUT_MS,
    );
    expect(CONST.BOOT_SPLASH_MIGRATION_TIMEOUT_MS).toBeLessThan(
      CONST.BOOT_SPLASH_STUCK_LOG_TIMEOUT_MS,
    );
  });

  it('does not leave the timeout timer armed once migrations finish', async () => {
    jest.useFakeTimers();
    try {
      await migrateOnyx();
      // A surviving 8 s timer would keep firing (and logging) long after the
      // app booted, and would hold a Node process open under Jest.
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
