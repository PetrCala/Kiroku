import {renderHook} from '@testing-library/react-native';
import {useOnyx} from 'react-native-onyx';
import type * as RNOnyx from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

jest.mock('@context/global/FirebaseContext', () => ({
  useFirebase: jest.fn(),
}));

jest.mock('react-native-onyx', () => {
  const actual = jest.requireActual<typeof RNOnyx>('react-native-onyx');
  return {
    ...actual,
    useOnyx: jest.fn(),
  };
});

const mockedUseFirebase = jest.mocked(useFirebase);
const mockedUseOnyx = jest.mocked(useOnyx);

type OnyxFixtures = {
  isLoadingApp?: boolean;
  onboarding?: unknown;
  acceptedTermsVersion?: number;
  displayName?: string;
  hasUserData?: boolean;
};

const TEST_UID = 'user-123';

function setupOnyx(fixtures: OnyxFixtures): void {
  // Cast through unknown because the real useOnyx signature is heavily
  // overloaded and we are only exercising the runtime behaviour here.
  const impl = (
    key: string,
    options?: {selector?: (l: unknown) => unknown},
  ) => {
    switch (key) {
      case ONYXKEYS.IS_LOADING_APP:
        return [fixtures.isLoadingApp, {status: 'loaded'}];
      case ONYXKEYS.NVP_ONBOARDING:
        return [fixtures.onboarding, {status: 'loaded'}];
      case ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION:
        return [fixtures.acceptedTermsVersion, {status: 'loaded'}];
      case ONYXKEYS.USER_DATA_LIST: {
        // The hook calls useOnyx twice on USER_DATA_LIST with different
        // selectors — once for displayName, once for hasUserData. We can
        // distinguish by probing the selector against a synthetic list.
        const fakeList = {[TEST_UID]: {profile: {display_name: 'name'}}};
        const probe = options?.selector?.(fakeList);
        if (typeof probe === 'boolean') {
          return [fixtures.hasUserData ?? false, {status: 'loaded'}];
        }
        return [fixtures.displayName, {status: 'loaded'}];
      }
      default:
        return [undefined, {status: 'loaded'}];
    }
  };
  mockedUseOnyx.mockImplementation(impl as unknown as typeof useOnyx);
}

function setAuth(uid: string | undefined): void {
  mockedUseFirebase.mockReturnValue({
    auth: uid ? {currentUser: {uid}} : {currentUser: null},
  } as unknown as ReturnType<typeof useFirebase>);
}

describe('useOnboardingFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CONFIG as {SKIP_ONBOARDING: boolean}).SKIP_ONBOARDING = false;
  });

  test('unauthenticated → ready, no fire', () => {
    setAuth(undefined);
    setupOnyx({isLoadingApp: false, hasUserData: false});

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(true);
    expect(result.current.shouldFireOnboarding).toBe(false);
    expect(result.current.currentOnboardingRoute).toBeNull();
  });

  test('authenticated but app still loading → not ready (splash gate)', () => {
    setAuth(TEST_UID);
    setupOnyx({isLoadingApp: true, hasUserData: true});

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(false);
    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('authenticated but user data not yet hydrated → not ready (splash gate)', () => {
    setAuth(TEST_UID);
    setupOnyx({isLoadingApp: false, hasUserData: false});

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(false);
    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('authenticated + completed_at set → no fire', () => {
    setAuth(TEST_UID);
    setupOnyx({
      isLoadingApp: false,
      hasUserData: true,
      onboarding: {completed_at: 1_700_000_000_000},
      acceptedTermsVersion: 1,
      displayName: 'name',
    });

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.isReady).toBe(true);
    expect(result.current.shouldFireOnboarding).toBe(false);
    expect(result.current.currentOnboardingRoute).toBeNull();
  });

  test('authenticated + undefined onboarding (legacy) → no fire', () => {
    setAuth(TEST_UID);
    setupOnyx({
      isLoadingApp: false,
      hasUserData: true,
      onboarding: undefined,
      acceptedTermsVersion: 1,
      displayName: 'name',
    });

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(false);
  });

  test('authenticated + incomplete + no terms version → routes to TERMS', () => {
    setAuth(TEST_UID);
    setupOnyx({
      isLoadingApp: false,
      hasUserData: true,
      onboarding: {last_visited_path: undefined},
      acceptedTermsVersion: undefined,
      displayName: undefined,
    });

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(true);
    expect(result.current.currentOnboardingRoute).toBe(ROUTES.ONBOARDING_TERMS);
  });

  test('authenticated + terms accepted + no display name → routes to DISPLAY_NAME', () => {
    setAuth(TEST_UID);
    setupOnyx({
      isLoadingApp: false,
      hasUserData: true,
      onboarding: {last_visited_path: undefined},
      acceptedTermsVersion: 1,
      displayName: undefined,
    });

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(true);
    expect(result.current.currentOnboardingRoute).toBe(
      ROUTES.ONBOARDING_DISPLAY_NAME,
    );
  });

  test('SKIP_ONBOARDING bypass overrides incomplete state', () => {
    setAuth(TEST_UID);
    (CONFIG as {SKIP_ONBOARDING: boolean}).SKIP_ONBOARDING = true;
    setupOnyx({
      isLoadingApp: false,
      hasUserData: true,
      onboarding: {last_visited_path: undefined},
      acceptedTermsVersion: undefined,
      displayName: undefined,
    });

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.shouldFireOnboarding).toBe(false);
    expect(result.current.skipOnboarding).toBe(true);
  });

  test('surfaces lastVisitedPath from onboarding state', () => {
    setAuth(TEST_UID);
    setupOnyx({
      isLoadingApp: false,
      hasUserData: true,
      onboarding: {last_visited_path: ROUTES.ONBOARDING_DISPLAY_NAME},
      acceptedTermsVersion: 1,
      displayName: undefined,
    });

    const {result} = renderHook(() => useOnboardingFlow());

    expect(result.current.lastVisitedPath).toBe(ROUTES.ONBOARDING_DISPLAY_NAME);
  });
});
