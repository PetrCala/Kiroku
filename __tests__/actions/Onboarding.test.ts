/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/no-api-in-views -- this test mocks and asserts the API.write calls the Onboarding action makes */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test asserts that completeOnboarding calls Onyx.merge with the expected payload */

import type {OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import * as UserActions from '@userActions/User';
import * as Onboarding from '@libs/actions/Onboarding';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Database} from 'firebase/database';
import type {User} from 'firebase/auth';

const TEST_UID = 'user-abc';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    merge: jest.fn(() => Promise.resolve()),
    METHOD: {SET: 'set', MERGE: 'merge'},
  },
}));

jest.mock('@libs/API', () => ({
  write: jest.fn(),
}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: jest.fn(() => ({currentUser: {uid: 'user-abc'}})),
}));

jest.mock('@userActions/User', () => ({
  setUsername: jest.fn(() => Promise.resolve()),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {navigate: jest.fn(), dismissModal: jest.fn()},
}));

jest.mock('@libs/Localize', () => ({
  translateLocal: (key: string) => key,
}));

const mockedWrite = jest.mocked(API.write);
const mockedMerge = jest.mocked(Onyx.merge);
const mockedSetUsername = jest.mocked(UserActions.setUsername);
const mockedGetFirebaseAuth = jest.mocked(getFirebaseAuth);

const TEST_USER = {uid: TEST_UID} as User;
const TEST_DB = {} as Database;

type WriteCall = [
  string,
  Record<string, unknown>,
  {optimisticData?: OnyxUpdate[]},
];

/** The (command, params, onyxData) tuple from the first API.write call. */
function firstWriteCall(): WriteCall {
  return mockedWrite.mock.calls[0] as unknown as WriteCall;
}

/** Find the optimistic update targeting a given Onyx key. */
function optimisticFor(
  optimisticData: OnyxUpdate[] | undefined,
  key: string,
): OnyxUpdate | undefined {
  return optimisticData?.find(update => update.key === key);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetFirebaseAuth.mockReturnValue({
    currentUser: {uid: TEST_UID},
  } as ReturnType<typeof getFirebaseAuth>);
});

describe('acceptTerms', () => {
  test('inside onboarding flow: writes via kiroku-api with mirrored optimistic data', () => {
    const before = Date.now();
    Onboarding.acceptTerms(ROUTES.ONBOARDING_TERMS);
    const after = Date.now();

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const [command, params, onyxData] = firstWriteCall();
    expect(command).toBe(WRITE_COMMANDS.ACCEPT_TERMS);
    // The client never sends a terms version — the server decides it.
    expect(params).toEqual({onboardingPath: ROUTES.ONBOARDING_TERMS});

    const userUpdate = optimisticFor(
      onyxData.optimisticData,
      ONYXKEYS.USER_DATA_LIST,
    );
    const userEntry = (
      userUpdate?.value as Record<string, Record<string, unknown>>
    )[TEST_UID];
    expect(userEntry.agreed_to_terms_version).toBe(CONST.CURRENT_TERMS_VERSION);
    const writtenAt = userEntry.agreed_to_terms_at as number;
    expect(writtenAt).toBeGreaterThanOrEqual(before);
    expect(writtenAt).toBeLessThanOrEqual(after);
    expect(userEntry.onboarding).toEqual({
      last_visited_path: ROUTES.ONBOARDING_TERMS,
    });

    const versionUpdate = optimisticFor(
      onyxData.optimisticData,
      ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION,
    );
    expect(versionUpdate?.onyxMethod).toBe(Onyx.METHOD.SET);
    expect(versionUpdate?.value).toBe(CONST.CURRENT_TERMS_VERSION);

    const onboardingUpdate = optimisticFor(
      onyxData.optimisticData,
      ONYXKEYS.NVP_ONBOARDING,
    );
    expect(onboardingUpdate?.value).toEqual({
      last_visited_path: ROUTES.ONBOARDING_TERMS,
    });
  });

  test('standalone re-consent (no path): does not touch onboarding state', () => {
    Onboarding.acceptTerms();

    const [command, params, onyxData] = firstWriteCall();
    expect(command).toBe(WRITE_COMMANDS.ACCEPT_TERMS);
    expect(params).toEqual({});

    const userUpdate = optimisticFor(
      onyxData.optimisticData,
      ONYXKEYS.USER_DATA_LIST,
    );
    const userEntry = (
      userUpdate?.value as Record<string, Record<string, unknown>>
    )[TEST_UID];
    expect('onboarding' in userEntry).toBe(false);
    expect(
      optimisticFor(onyxData.optimisticData, ONYXKEYS.NVP_ONBOARDING),
    ).toBeUndefined();
    expect(
      optimisticFor(
        onyxData.optimisticData,
        ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION,
      ),
    ).toBeDefined();
  });

  test('no-op when signed out', () => {
    mockedGetFirebaseAuth.mockReturnValue({
      currentUser: null,
    } as ReturnType<typeof getFirebaseAuth>);

    Onboarding.acceptTerms(ROUTES.ONBOARDING_TERMS);

    expect(mockedWrite).not.toHaveBeenCalled();
  });
});

describe('setDisplayName', () => {
  test('delegates to setUsername (now via kiroku-api) and writes last_visited_path via kiroku-api', async () => {
    await Onboarding.setDisplayName(TEST_DB, TEST_USER, 'new');

    expect(mockedSetUsername).toHaveBeenCalledWith(TEST_USER, 'new');

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const [command, params, onyxData] = firstWriteCall();
    expect(command).toBe(WRITE_COMMANDS.SET_ONBOARDING_LAST_VISITED_PATH);
    expect(params).toEqual({path: ROUTES.ONBOARDING_DISPLAY_NAME});

    expect(
      optimisticFor(onyxData.optimisticData, ONYXKEYS.NVP_ONBOARDING)?.value,
    ).toEqual({last_visited_path: ROUTES.ONBOARDING_DISPLAY_NAME});
    const userUpdate = optimisticFor(
      onyxData.optimisticData,
      ONYXKEYS.USER_DATA_LIST,
    );
    expect(userUpdate?.value).toEqual({
      [TEST_UID]: {
        onboarding: {last_visited_path: ROUTES.ONBOARDING_DISPLAY_NAME},
      },
    });
  });

  test('rejects when user is null and never writes', async () => {
    await expect(
      Onboarding.setDisplayName(TEST_DB, null, 'new'),
    ).rejects.toThrow('common.error.userNull');
    expect(mockedSetUsername).not.toHaveBeenCalled();
    expect(mockedWrite).not.toHaveBeenCalled();
  });
});

describe('completeOnboarding', () => {
  test('applies the optimistic Onyx merge BEFORE firing the server write', async () => {
    const callOrder: string[] = [];
    mockedMerge.mockImplementation(() => {
      callOrder.push('onyx');
      return Promise.resolve();
    });
    mockedWrite.mockImplementation(() => {
      callOrder.push('api');
      return Promise.resolve();
    });

    await Onboarding.completeOnboarding();

    // Both completion merges must precede the write so `shouldFireOnboarding`
    // flips before the caller's dismissal pop (OnboardingGuard race).
    expect(callOrder).toEqual(['onyx', 'onyx', 'api']);

    const mergedKeys = mockedMerge.mock.calls.map(call => call[0]);
    expect(mergedKeys).toEqual(
      expect.arrayContaining([
        ONYXKEYS.NVP_ONBOARDING,
        ONYXKEYS.USER_DATA_LIST,
      ]),
    );

    const [command, params] = firstWriteCall();
    expect(command).toBe(WRITE_COMMANDS.COMPLETE_ONBOARDING);
    expect(params).toEqual({});
  });

  test('no-op when signed out', async () => {
    mockedGetFirebaseAuth.mockReturnValue({
      currentUser: null,
    } as ReturnType<typeof getFirebaseAuth>);

    await Onboarding.completeOnboarding();

    expect(mockedMerge).not.toHaveBeenCalled();
    expect(mockedWrite).not.toHaveBeenCalled();
  });
});

describe('setLastVisitedPath', () => {
  test('writes the path via kiroku-api with mirrored optimistic data', () => {
    Onboarding.setLastVisitedPath(ROUTES.ONBOARDING_TERMS);

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const [command, params] = firstWriteCall();
    expect(command).toBe(WRITE_COMMANDS.SET_ONBOARDING_LAST_VISITED_PATH);
    expect(params).toEqual({path: ROUTES.ONBOARDING_TERMS});
  });

  test('no-op when signed out', () => {
    mockedGetFirebaseAuth.mockReturnValue({
      currentUser: null,
    } as ReturnType<typeof getFirebaseAuth>);

    Onboarding.setLastVisitedPath(ROUTES.ONBOARDING_TERMS);

    expect(mockedWrite).not.toHaveBeenCalled();
  });
});
