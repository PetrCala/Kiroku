/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) and per-user map keys are dictated by the real envelope shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this integration test seeds/asserts Onyx directly to model the cold-launch reset semantics */
/* eslint-disable rulesdir/no-onyx-connect, rulesdir/prefer-onyx-connect-in-libs -- test-only Onyx.connect to read final state; there is no React render here */

/**
 * Regression coverage for the cold-launch calendar reset against a REAL Onyx
 * instance (only the storage layer is the in-memory mock).
 *
 * The shipped `Calendar.resetCalendarStateForColdLaunch` relies on a subtle Onyx
 * contract: a value persisted in a previous session must be CLEARED on cold
 * launch, and the only operation that reliably does so is `Onyx.merge(key, null)`
 * — `initialKeyStates: { key: null }` is dropped during hydration
 * (`shouldRemoveNestedNulls`), so it silently leaves the stale value in place.
 * If that ever regresses, the calendar reopens on whatever month the user last
 * scrolled to instead of today.
 *
 * It also locks the per-user map's structural independence (Calendar Rule 2):
 * `NVP_LAST_VIEWED_CALENDAR_DATE` is `Record<UserID, DateString>`, so one user's
 * slot can be written or deleted without disturbing another's.
 */
import Onyx from 'react-native-onyx';
import type {OnyxKey} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DateString} from '@src/types/onyx/OnyxCommon';

const DATE_A = '2026-06-19' as DateString;
const DATE_B = '2026-01-02' as DateString;

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

const KEY = ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE;

function readOnce<T>(key: OnyxKey): Promise<T | undefined> {
  return new Promise<T | undefined>(resolve => {
    const connection = Onyx.connect({
      key,
      callback: (value: unknown) => {
        Onyx.disconnect(connection);
        resolve(value as T | undefined);
      },
    });
  });
}

// Flush a few macrotask ticks so real Onyx writes settle (jsdom lacks setImmediate).
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential tick flush: each await lets the prior Onyx write settle before the next
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0);
    });
  }
}

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
  await Onyx.clear();
  await settle();
});

describe('cold-launch calendar reset (Onyx semantics)', () => {
  it('merge(key, null) clears a value persisted from a previous session', async () => {
    await Onyx.set(KEY, {'user-1': DATE_A});
    await settle();
    expect(await readOnce(KEY)).toEqual({'user-1': DATE_A});

    // The shipped reset path.
    await Onyx.merge(KEY, null);
    await settle();

    expect(await readOnce(KEY)).toBeUndefined();
  });

  it('initialKeyStates: { key: null } is a no-op — the persisted value survives a re-hydration', async () => {
    await Onyx.set(KEY, {'user-1': DATE_A});
    await settle();

    // Re-hydrate the way a cold launch does, asking for the key to default to
    // null. Onyx drops the null default, so the stored value is untouched: this
    // is exactly why `initialKeyStates` cannot be used to reset the calendar.
    Onyx.init({keys: ONYXKEYS, initialKeyStates: {[KEY]: null}});
    await settle();

    expect(await readOnce(KEY)).toEqual({'user-1': DATE_A});

    // ...whereas merge(null) does clear it.
    await Onyx.merge(KEY, null);
    await settle();
    expect(await readOnce(KEY)).toBeUndefined();
  });
});

describe('per-user last-viewed map isolation (Calendar Rule 2)', () => {
  it('writing one user’s slot leaves every other user’s slot intact', async () => {
    // Mirrors App.setLastViewedCalendarDate(userID, date): a per-user merge.
    await Onyx.merge(KEY, {self: DATE_A});
    await Onyx.merge(KEY, {friend: DATE_B});
    await settle();

    expect(await readOnce(KEY)).toEqual({
      self: DATE_A,
      friend: DATE_B,
    });
  });

  it('clearing one user’s slot (nested null) deletes only that user', async () => {
    await Onyx.merge(KEY, {self: DATE_A, friend: DATE_B});
    await settle();

    // Mirrors App.clearLastViewedCalendarDate('self').
    await Onyx.merge(KEY, {self: null});
    await settle();

    expect(await readOnce(KEY)).toEqual({friend: DATE_B});
  });
});
