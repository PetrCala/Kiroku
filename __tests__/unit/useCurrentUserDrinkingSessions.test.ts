/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {renderHook} from '@testing-library/react-native';
import {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import type {DrinkingSessionList} from '@src/types/onyx';
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

const USER_ID = 'u1';

function makeSessions(): DrinkingSessionList {
  return {
    s1: {
      start_time: 1_700_000_000_000,
      end_time: 1_700_000_900_000,
      drinks: {1_700_000_000_000: {beer: 1}},
    },
  };
}

function setAuth(uid: string | undefined): void {
  mockedUseFirebase.mockReturnValue({
    auth: uid ? {currentUser: {uid}} : {currentUser: null},
  } as unknown as ReturnType<typeof useFirebase>);
}

// The hook reads only the value (the entry's presence is the whole contract);
// the status metadata is intentionally not consulted — see the hook's docblock.
function setOnyx(value: UserDrinkingSessionsList | null | undefined): void {
  mockedUseOnyx.mockReturnValue([value, {status: 'loaded'}] as ReturnType<
    typeof useOnyx
  >);
}

describe('useCurrentUserDrinkingSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuth(USER_ID);
  });

  test('no signed-in user returns undefined', () => {
    setAuth(undefined);
    setOnyx({[USER_ID]: makeSessions()});

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toBeUndefined();
  });

  test('whole key null (post sign-out) returns undefined — entry not delivered', () => {
    // `cleanupSession` does `Onyx.set(CACHED_DRINKING_SESSIONS, null)`. There's
    // no entry for the user, so the snapshot is "not resolved" — HomeScreen,
    // not this hook, decides loading-vs-offline from the network state.
    setOnyx(null);

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toBeUndefined();
  });

  test('key present but no entry for any user returns undefined', () => {
    setOnyx({});

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toBeUndefined();
  });

  test('an entry for another user only returns undefined for this user', () => {
    setOnyx({otherUser: makeSessions()});

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toBeUndefined();
  });

  test('a null entry for this user (loaded, no sessions) returns {}', () => {
    setOnyx({[USER_ID]: null} as unknown as UserDrinkingSessionsList);

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toEqual({});
  });

  test('an empty-object entry (app/open seed for a no-session user) passes through as {}', () => {
    setOnyx({[USER_ID]: {}});

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toEqual({});
  });

  test('a populated entry passes through unchanged', () => {
    const sessions = makeSessions();
    setOnyx({[USER_ID]: sessions});

    const {result} = renderHook(() => useCurrentUserDrinkingSessions());

    expect(result.current).toBe(sessions);
  });

  test('the null-entry empty result is a stable reference across renders', () => {
    setOnyx({[USER_ID]: null} as unknown as UserDrinkingSessionsList);

    const {result, rerender} = renderHook(() =>
      useCurrentUserDrinkingSessions(),
    );
    const first = result.current;

    rerender(undefined);

    expect(result.current).toBe(first);
  });
});
