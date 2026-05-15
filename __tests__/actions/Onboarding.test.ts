/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule, __path) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test asserts that the Onboarding action calls Onyx.merge with the expected payload */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */

import {ref, set, update} from 'firebase/database';
import type {Database} from 'firebase/database';
import type {User} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import * as UserActions from '@userActions/User';
import Log from '@libs/Log';
import * as Onboarding from '@libs/actions/Onboarding';
import CONST from '@src/CONST';
import DBPATHS from '@src/DBPATHS';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

jest.mock('firebase/database', () => ({
  ref: jest.fn((_db: unknown, path?: string) => ({__path: path ?? '<root>'})),
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    merge: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@userActions/User', () => ({
  setUsername: jest.fn(() => Promise.resolve()),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {navigate: jest.fn()},
}));

jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@libs/Localize', () => ({
  translateLocal: (key: string) => key,
}));

const mockedRef = jest.mocked(ref);
const mockedSet = jest.mocked(set);
const mockedUpdate = jest.mocked(update);
const mockedOnyx = jest.mocked(Onyx);
const mockedMerge = mockedOnyx.merge;
const mockedSetUsername = jest.mocked(UserActions.setUsername);
const mockedLog = jest.mocked(Log);
const mockedLogWarn = mockedLog.warn;

const TEST_UID = 'user-abc';
const TEST_USER = {uid: TEST_UID} as User;
const TEST_DB = {} as Database;

function onyxKeysCalled(): string[] {
  return mockedMerge.mock.calls.map(call => call[0]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('acceptTerms', () => {
  test('inside onboarding flow: writes three Firebase paths + mirrors Onyx', async () => {
    const before = Date.now();
    await Onboarding.acceptTerms(TEST_DB, TEST_USER, ROUTES.ONBOARDING_TERMS);
    const after = Date.now();

    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    const updatePayload = mockedUpdate.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(Object.keys(updatePayload)).toEqual(
      expect.arrayContaining([
        DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_AT.getRoute(TEST_UID),
        DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_VERSION.getRoute(TEST_UID),
        DBPATHS.USERS_USER_ID_ONBOARDING_LAST_VISITED_PATH.getRoute(TEST_UID),
      ]),
    );
    expect(
      updatePayload[
        DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_VERSION.getRoute(TEST_UID)
      ],
    ).toBe(CONST.CURRENT_TERMS_VERSION);
    const writtenAt = updatePayload[
      DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_AT.getRoute(TEST_UID)
    ] as number;
    expect(writtenAt).toBeGreaterThanOrEqual(before);
    expect(writtenAt).toBeLessThanOrEqual(after);

    expect(onyxKeysCalled()).toEqual(
      expect.arrayContaining([
        ONYXKEYS.USER_DATA_LIST,
        ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION,
        ONYXKEYS.NVP_ONBOARDING,
      ]),
    );
  });

  test('standalone re-consent (no path): does not touch onboarding state', async () => {
    await Onboarding.acceptTerms(TEST_DB, TEST_USER);

    const updatePayload = mockedUpdate.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(
      DBPATHS.USERS_USER_ID_ONBOARDING_LAST_VISITED_PATH.getRoute(TEST_UID) in
        updatePayload,
    ).toBe(false);

    expect(onyxKeysCalled()).not.toContain(ONYXKEYS.NVP_ONBOARDING);
    expect(onyxKeysCalled()).toEqual(
      expect.arrayContaining([
        ONYXKEYS.USER_DATA_LIST,
        ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION,
      ]),
    );
  });

  test('rejects when user is null', async () => {
    await expect(Onboarding.acceptTerms(TEST_DB, null)).rejects.toThrow(
      'common.error.userNull',
    );
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});

describe('setDisplayName', () => {
  test('delegates to setUsername and writes last_visited_path', async () => {
    await Onboarding.setDisplayName(TEST_DB, TEST_USER, 'old', 'new');

    expect(mockedSetUsername).toHaveBeenCalledWith(
      TEST_DB,
      TEST_USER,
      'old',
      'new',
    );

    const updatePayload = mockedUpdate.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(
      updatePayload[
        DBPATHS.USERS_USER_ID_ONBOARDING_LAST_VISITED_PATH.getRoute(TEST_UID)
      ],
    ).toBe(ROUTES.ONBOARDING_DISPLAY_NAME);

    expect(onyxKeysCalled()).toEqual(
      expect.arrayContaining([
        ONYXKEYS.USER_DATA_LIST,
        ONYXKEYS.NVP_ONBOARDING,
      ]),
    );
  });

  test('rejects when user is null', async () => {
    await expect(
      Onboarding.setDisplayName(TEST_DB, null, 'old', 'new'),
    ).rejects.toThrow('common.error.userNull');
    expect(mockedSetUsername).not.toHaveBeenCalled();
  });
});

describe('completeOnboarding', () => {
  test('merges Onyx before firing the Firebase set, and does not await the write', async () => {
    const callOrder: string[] = [];
    mockedMerge.mockImplementation(() => {
      callOrder.push('onyx');
      return Promise.resolve();
    });
    mockedSet.mockImplementation(() => {
      callOrder.push('firebase');
      return Promise.resolve();
    });

    await Onboarding.completeOnboarding(TEST_DB, TEST_USER);

    expect(callOrder[0]).toBe('onyx');
    expect(callOrder).toContain('firebase');

    const completedAtPath =
      DBPATHS.USERS_USER_ID_ONBOARDING_COMPLETED_AT.getRoute(TEST_UID);
    expect(mockedRef).toHaveBeenCalledWith(TEST_DB, completedAtPath);

    expect(onyxKeysCalled()).toEqual(
      expect.arrayContaining([
        ONYXKEYS.NVP_ONBOARDING,
        ONYXKEYS.USER_DATA_LIST,
      ]),
    );
  });

  test('swallows a rejecting Firebase write via Log.warn', async () => {
    mockedSet.mockReturnValueOnce(Promise.reject(new Error('offline')));

    await expect(
      Onboarding.completeOnboarding(TEST_DB, TEST_USER),
    ).resolves.toBeUndefined();

    await Promise.resolve();
    await Promise.resolve();

    expect(mockedLogWarn).toHaveBeenCalledTimes(1);
    const [msg, payload] = mockedLogWarn.mock.calls[0];
    expect(msg).toContain('[Onboarding]');
    expect(payload).toBeDefined();
    expect((payload as {error: unknown}).error).toBeInstanceOf(Error);
  });

  test('rejects when user is null', async () => {
    await expect(Onboarding.completeOnboarding(TEST_DB, null)).rejects.toThrow(
      'common.error.userNull',
    );
    expect(mockedMerge).not.toHaveBeenCalled();
    expect(mockedSet).not.toHaveBeenCalled();
  });
});
