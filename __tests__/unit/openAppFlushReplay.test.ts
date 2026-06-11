/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) and captured RTDB push-ids / epoch-ms keys are dictated by the real envelope shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this integration test seeds/asserts Onyx directly to model the poisoned-store cold-launch the flush must heal */
/* eslint-disable rulesdir/no-onyx-connect -- this test reads final Onyx state via connect; it is not app code */
/* eslint-disable rulesdir/prefer-onyx-connect-in-libs -- same: test-only Onyx.connect to assert the flushed state */

/**
 * Replays the EXACT app/open response envelope captured from the dev backend
 * (2026-06-11, uid UJs3…) through a real react-native-onyx instance the same
 * way the deferred-write flush does — one Onyx.update over the concatenated
 * [response.onyxData…, request.finallyData…] batch — and asserts that the
 * user record actually lands alongside `isLoadingApp: false`.
 *
 * Field evidence said the opposite happened on device: the flush left
 * `isLoadingApp === false` while USER_DATA_LIST kept a stale seed record, so
 * this test exists to catch any entry in the real envelope that makes the
 * batch reject or skip the record merge.
 */
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

const UID = 'UJs3YL6bOFPD6mWsZsSjzKIkgZP2';

// Captured via an authenticated replay of GET /v1/app/open (values abridged
// only where the content is irrelevant to Onyx semantics — shapes preserved).
const SERVER_ONYX_DATA = [
  {onyxMethod: 'merge', key: 'session', value: {userID: UID, email: 'x@x.cz'}},
  {
    onyxMethod: 'merge',
    key: 'userDataList',
    value: {
      [UID]: {
        agreed_to_terms_at: 1781098306921,
        agreed_to_terms_version: 1,
        earliest_session_at: 1780407243577,
        onboarding: {
          completed_at: 1781098307827,
          last_visited_path: 'onboarding/display-name',
        },
        profile: {
          display_name: 'lacapetr',
          photo_url: '',
          username_chosen: true,
        },
        role: 'open_beta_user',
        timezone: {automatic: true, selected: 'Europe/Prague'},
      },
    },
  },
  {onyxMethod: 'set', key: 'nvp_termsAcceptedVersion', value: 1},
  {
    onyxMethod: 'merge',
    key: 'nvp_onboarding',
    value: {
      completed_at: 1781098307827,
      last_visited_path: 'onboarding/display-name',
    },
  },
  {onyxMethod: 'merge', key: 'cachedDrinkingSessions', value: {[UID]: null}},
  {
    onyxMethod: 'merge',
    key: 'cachedDrinkingSessions',
    value: {
      [UID]: {
        '-Oulj7MD2Htmnf2Lg8up': {
          blackout: false,
          drinks: {1781098387370: {weak_shot: 1}},
          end_time: 1781098387370,
          start_time: 1781098387370,
          type: 'edit',
        },
      },
    },
  },
  {onyxMethod: 'set', key: 'dataVisibility', value: null},
  {
    onyxMethod: 'set',
    key: 'preferences',
    value: {
      drinks_to_units: {beer: 1, weak_shot: 0.5},
      first_day_of_week: 'Monday',
    },
  },
  {onyxMethod: 'set', key: 'preferredTheme', value: 'system'},
  {
    onyxMethod: 'set',
    key: 'config',
    value: {
      app_settings: {latest_version: '0.3.13', min_supported_version: '0.3.0'},
      terms_last_updated: 1781163147961,
    },
  },
] as Parameters<typeof Onyx.update>[0];

const FINALLY_DATA = [
  {onyxMethod: 'merge', key: 'isLoadingApp', value: false},
] as Parameters<typeof Onyx.update>[0];

describe('openApp deferred-flush replay', () => {
  beforeAll(() => {
    Onyx.init({keys: ONYXKEYS});
  });

  test('the real app/open envelope applies the user record together with isLoadingApp=false', async () => {
    // Stale poisoned state from a previous session: the new-account seed.
    await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
      [UID]: {
        profile: {
          display_name: 'lacapetr',
          photo_url: '',
          username_chosen: false,
        },
        role: 'open_beta_user',
        timezone: {automatic: true, selected: 'Europe/Prague'},
      },
    });
    await Onyx.merge(ONYXKEYS.IS_LOADING_APP, true);

    // The flush concatenates response onyxData and request finallyData into a
    // single Onyx.update (QueuedOnyxUpdates.flushQueue).
    let flushError: unknown = null;
    await Onyx.update([...SERVER_ONYX_DATA, ...FINALLY_DATA]).catch(error => {
      flushError = error;
    });

    const [isLoadingApp, userDataList] = await Promise.all([
      new Promise(resolve => {
        const conn = Onyx.connect({
          key: ONYXKEYS.IS_LOADING_APP,
          callback: value => {
            Onyx.disconnect(conn);
            resolve(value);
          },
        });
      }),
      new Promise(resolve => {
        const conn = Onyx.connect({
          key: ONYXKEYS.USER_DATA_LIST,
          callback: value => {
            Onyx.disconnect(conn);
            resolve(value);
          },
        });
      }),
    ]);

    expect(flushError).toBeNull();
    expect(isLoadingApp).toBe(false);
    const record = (userDataList as Record<string, Record<string, unknown>>)?.[
      UID
    ];
    // The poisoned seed must have been healed by the server record.
    expect(record?.profile).toEqual(
      expect.objectContaining({username_chosen: true}),
    );
    expect(record?.onboarding).toEqual(
      expect.objectContaining({completed_at: 1781098307827}),
    );
    expect(record?.agreed_to_terms_at).toBe(1781098306921);
  });
});
