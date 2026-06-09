/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {renderHook} from '@testing-library/react-native';
import {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  useOnyx: jest.fn(),
  default: {},
}));

jest.mock('@context/global/FirebaseContext', () => ({
  useFirebase: jest.fn(),
}));

const mockedUseOnyx = jest.mocked(useOnyx);
const mockedUseFirebase = jest.mocked(useFirebase);

function setAuth(uid: string | undefined): void {
  mockedUseFirebase.mockReturnValue({
    auth: uid ? {currentUser: {uid}} : {currentUser: null},
  } as unknown as ReturnType<typeof useFirebase>);
}

function setOnyx(
  value: UserDrinkingSessionsList | null | undefined,
  status: 'loading' | 'loaded',
): void {
  mockedUseOnyx.mockReturnValue([value, {status}] as unknown as ReturnType<
    typeof useOnyx
  >);
}

const SESSIONS_FOR_U1: UserDrinkingSessionsList = {
  u1: {
    s1: {
      start_time: 1,
      end_time: 2,
      timezone: 'Africa/Abidjan',
      drinks: {1: {beer: 1}},
    },
  },
} as unknown as UserDrinkingSessionsList;

describe('useCurrentUserDrinkingSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuth('u1');
  });

  test('no signed-in user → undefined regardless of cache', () => {
    setAuth(undefined);
    setOnyx(SESSIONS_FOR_U1, 'loaded');

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toBeUndefined();
  });

  test('still loading from disk → undefined (genuinely "not ready")', () => {
    setOnyx(undefined, 'loading');

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toBeUndefined();
  });

  test('loaded with this user`s sessions → returns them', () => {
    setOnyx(SESSIONS_FOR_U1, 'loaded');

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toEqual(SESSIONS_FOR_U1.u1);
  });

  // Regression: the offline home-skeleton hang. The cache key has finished
  // hydrating but holds no entry for this user — a brand-new account, a
  // post-sign-out reset (`Onyx.set(CACHED_DRINKING_SESSIONS, null)`), or an
  // offline cold start where `app/open` never reached the network. This must
  // resolve to a ready-but-empty object, NOT stay undefined (which the home
  // readiness gate reads as "still loading" → skeletons forever).
  test('loaded but no entry for this user → ready-but-empty object', () => {
    setOnyx({u2: {}}, 'loaded');

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toEqual({});
    expect(result.current).not.toBeUndefined();
  });

  test('loaded with the whole cache null (post sign-out) → ready-but-empty', () => {
    setOnyx(null, 'loaded');

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toEqual({});
    expect(result.current).not.toBeUndefined();
  });

  test('loaded with this user`s entry explicitly null → ready-but-empty', () => {
    setOnyx({u1: null} as unknown as UserDrinkingSessionsList, 'loaded');

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toEqual({});
    expect(result.current).not.toBeUndefined();
  });

  test('the empty-state object keeps a stable reference across renders', () => {
    setOnyx(null, 'loaded');

    const {result, rerender} = renderHook(() =>
      useCurrentUserDrinkingSessions(),
    );
    const first = result.current;
    rerender(undefined);

    expect(result.current).toBe(first);
  });
});
