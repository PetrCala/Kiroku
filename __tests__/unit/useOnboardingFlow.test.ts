/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {renderHook} from '@testing-library/react-native';
import {useOnyx} from 'react-native-onyx';
import type * as RNOnyx from 'react-native-onyx';
import {useConfig} from '@context/global/ConfigContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Config, UserData} from '@src/types/onyx';

jest.mock('@context/global/FirebaseContext', () => ({
  useFirebase: jest.fn(),
}));

jest.mock('@context/global/ConfigContext', () => ({
  useConfig: jest.fn(),
}));

jest.mock('@hooks/useCurrentUserData', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('react-native-onyx', () => {
  const actual = jest.requireActual<typeof RNOnyx>('react-native-onyx');
  return {
    ...actual,
    useOnyx: jest.fn(),
  };
});

// The hook's temporary fire-diagnostics import `Log`, which transitively runs
// a module-scope `Onyx.connect` (src/libs/Console) that the partial Onyx mock
// above can't satisfy. The diagnostics are irrelevant to these tests.
jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {info: jest.fn()},
}));

// Same story for the diagnostics' apply-trace import: the real OnyxUpdates
// pulls in SequentialQueue/PersistedRequests, which run module-scope
// Onyx.connect calls the partial mock can't satisfy.
jest.mock('@userActions/OnyxUpdates', () => ({
  getApplyTrace: jest.fn(() => []),
}));

const mockedUseFirebase = jest.mocked(useFirebase);
const mockedUseConfig = jest.mocked(useConfig);
const mockedUseCurrentUserData = jest.mocked(useCurrentUserData);
const mockedUseOnyx = jest.mocked(useOnyx);

const TEST_UID = 'user-123';

function setAuth(uid: string | undefined): void {
  mockedUseFirebase.mockReturnValue({
    auth: uid ? {currentUser: {uid}} : {currentUser: null},
  } as unknown as ReturnType<typeof useFirebase>);
}

// `IS_LOADING_APP` is `true` while the OpenApp bootstrap is in flight and
// `false` once it settles; the readiness gate requires the explicit `false`.
function setIsLoadingApp(value: boolean | undefined): void {
  mockedUseOnyx.mockImplementation(((key: string) => {
    if (key === ONYXKEYS.IS_LOADING_APP) {
      return [value, {status: 'loaded'}];
    }
    return [undefined, {status: 'loaded'}];
  }) as unknown as typeof useOnyx);
}

// `userData` comes from `useCurrentUserData` (Onyx), which returns {} (not
// undefined) while not hydrated; `config` comes from `useConfig` (Onyx-backed).
function setUserData(userData: UserData | undefined, config?: Config): void {
  mockedUseConfig.mockReturnValue({config});
  mockedUseCurrentUserData.mockReturnValue(userData ?? {});
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

  test('authenticated + userData not hydrated → not ready (splash gate)', () => {
    setAuth(TEST_UID);
    setUserData(undefined);

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(false);
    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('authenticated + OpenApp still in flight (isLoadingApp true) → not ready, no fire', () => {
    setAuth(TEST_UID);
    setIsLoadingApp(true);
    // Even a complete, already-onboarded record must not be acted on until the
    // bootstrap settles — the record may still be mid-assembly.
    setUserData(
      makeUserData({
        agreed_to_terms_at: 1_700_000_000_000,
        onboarding: {completed_at: 1_700_000_000_000},
        profile: {
          display_name: 'name',
          photo_url: '',
          username_chosen: true,
        },
      }),
    );

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(false);
    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('established user, no completed_at, username chosen, terms current → no fire (undefined onboarding = completed)', () => {
    setAuth(TEST_UID);
    setUserData(
      makeUserData({
        agreed_to_terms_at: 1_700_000_000_000,
        // No `onboarding` node at all — a returning account that predates the
        // completed_at stamp.
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
  });

  test('returning record missing onboarding AND terms but username chosen → no fire (re-prompt regression guard)', () => {
    setAuth(TEST_UID);
    setUserData(
      makeUserData({
        // Neither completed_at, nor agreed_to_terms_at — the exact shape that
        // used to fall through both selectors and re-fire onboarding.
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
        agreed_to_terms_at: 1_700_000_000_000,
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
        agreed_to_terms_at: 1_700_000_000_000,
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
