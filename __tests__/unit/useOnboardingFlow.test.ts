import {renderHook} from '@testing-library/react-native';
import {useOnyx} from 'react-native-onyx';
import type * as RNOnyx from 'react-native-onyx';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {UserData} from '@src/types/onyx';

jest.mock('@context/global/FirebaseContext', () => ({
  useFirebase: jest.fn(),
}));

jest.mock('@context/global/DatabaseDataContext', () => ({
  useDatabaseData: jest.fn(),
}));

jest.mock('react-native-onyx', () => {
  const actual = jest.requireActual<typeof RNOnyx>('react-native-onyx');
  return {
    ...actual,
    useOnyx: jest.fn(),
  };
});

const mockedUseFirebase = jest.mocked(useFirebase);
const mockedUseDatabaseData = jest.mocked(useDatabaseData);
const mockedUseOnyx = jest.mocked(useOnyx);

const TEST_UID = 'user-123';

function setAuth(uid: string | undefined): void {
  mockedUseFirebase.mockReturnValue({
    auth: uid ? {currentUser: {uid}} : {currentUser: null},
  } as unknown as ReturnType<typeof useFirebase>);
}

function setIsLoadingApp(value: boolean | undefined): void {
  mockedUseOnyx.mockImplementation(((key: string) => {
    if (key === ONYXKEYS.IS_LOADING_APP) {
      return [value, {status: 'loaded'}];
    }
    return [undefined, {status: 'loaded'}];
  }) as unknown as typeof useOnyx);
}

function setUserData(userData: UserData | undefined): void {
  mockedUseDatabaseData.mockReturnValue({
    userData,
  } as unknown as ReturnType<typeof useDatabaseData>);
}

function makeUserData(overrides: Partial<UserData> = {}): UserData {
  return {
    profile: {
      display_name: 'placeholder',
      photo_url: '',
    },
    role: 'open_beta_user',
    ...overrides,
  };
}

describe('useOnboardingFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CONFIG as {SKIP_ONBOARDING: boolean}).SKIP_ONBOARDING = false;
    setIsLoadingApp(false);
    setUserData(undefined);
  });

  test('unauthenticated → ready, no fire', () => {
    setAuth(undefined);

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(true);
    expect(result.current.shouldFireOnboarding).toBe(false);
    expect(result.current.currentOnboardingRoute).toBeNull();
  });

  test('authenticated + app still loading → not ready (splash gate)', () => {
    setAuth(TEST_UID);
    setIsLoadingApp(true);
    setUserData(makeUserData());

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(false);
    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('authenticated + userData not hydrated → not ready (splash gate)', () => {
    setAuth(TEST_UID);
    setIsLoadingApp(false);
    setUserData(undefined);

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(false);
    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('completed_at set → no fire', () => {
    setAuth(TEST_UID);
    setUserData(
      makeUserData({
        agreed_to_terms_at: 1_700_000_000_000,
        agreed_to_terms_version: 1,
        onboarding: {completed_at: 1_700_000_000_000},
        profile: {
          display_name: 'name',
          photo_url: '',
          username_chosen: true,
        },
      }),
    );

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(true);
    expect(result.current.shouldFireOnboarding).toBe(false);
    expect(result.current.currentOnboardingRoute).toBeNull();
  });

  test('legacy grandfathered (terms_at set, username_chosen true, no completed_at) → no fire', () => {
    setAuth(TEST_UID);
    setUserData(
      makeUserData({
        agreed_to_terms_at: 1_700_000_000_000,
        profile: {
          display_name: 'name',
          photo_url: '',
          username_chosen: true,
        },
      }),
    );

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('legacy grandfathered (terms_at set, username_chosen undefined) → no fire', () => {
    setAuth(TEST_UID);
    setUserData(
      makeUserData({
        agreed_to_terms_at: 1_700_000_000_000,
      }),
    );

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('brand-new account (no terms_at, no onboarding, username_chosen=false) → fires TERMS', () => {
    setAuth(TEST_UID);
    setUserData(
      makeUserData({
        profile: {
          display_name: 'foo@example.com',
          photo_url: '',
          username_chosen: false,
        },
      }),
    );

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(true);
    expect(result.current.currentOnboardingRoute).toBe(ROUTES.ONBOARDING_TERMS);
  });

  test('terms accepted + username_chosen=false → routes to DISPLAY_NAME', () => {
    setAuth(TEST_UID);
    setUserData(
      makeUserData({
        agreed_to_terms_version: 1,
        profile: {
          display_name: 'foo@example.com',
          photo_url: '',
          username_chosen: false,
        },
      }),
    );

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(true);
    expect(result.current.currentOnboardingRoute).toBe(
      ROUTES.ONBOARDING_DISPLAY_NAME,
    );
  });

  test('SKIP_ONBOARDING bypass overrides incomplete state', () => {
    setAuth(TEST_UID);
    (CONFIG as {SKIP_ONBOARDING: boolean}).SKIP_ONBOARDING = true;
    setUserData(
      makeUserData({
        profile: {
          display_name: 'foo@example.com',
          photo_url: '',
          username_chosen: false,
        },
      }),
    );

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(false);
    expect(result.current.skipOnboarding).toBe(true);
  });

  test('surfaces lastVisitedPath from onboarding state', () => {
    setAuth(TEST_UID);
    setUserData(
      makeUserData({
        agreed_to_terms_version: 1,
        onboarding: {last_visited_path: ROUTES.ONBOARDING_DISPLAY_NAME},
        profile: {
          display_name: 'foo@example.com',
          photo_url: '',
          username_chosen: false,
        },
      }),
    );

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.lastVisitedPath).toBe(ROUTES.ONBOARDING_DISPLAY_NAME);
  });
});
