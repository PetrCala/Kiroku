/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/no-require-imports, global-require -- jest mock factories require their deps lazily */

/**
 * Coverage for useFriendsData's cold-load gate.
 *
 * `USER_DATA_LIST` persists across app restarts, so cache PRESENCE says
 * nothing about cache AGE. The gate must hold the first open of an app run on
 * a live sync (skeletons) even when a stale cache exists, then hand over to
 * stale-while-revalidate for every later mount. Offline and slow-network
 * openings fall back to the cache instead of holding skeletons forever.
 */
import {act, renderHook} from '@testing-library/react-native';
import {useOnyx} from 'react-native-onyx';
import useFriendsData from '@hooks/useFriendsData';
import {resetSyncedThisAppRunForTests} from '@hooks/useFriendsData/sessionSync';
import useNetwork from '@hooks/useNetwork';
import * as Profile from '@userActions/Profile';
import CONST from '@src/CONST';
import type {UserDataList} from '@src/types/onyx';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  useOnyx: jest.fn(),
  default: {},
}));

// Run the focus callback as a plain effect: these tests exercise mount and
// unmount, not navigation focus transitions.
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useFocusEffect: (callback: () => void | (() => void)) => {
    const {useEffect} = require('react') as {
      useEffect: (effect: () => void | (() => void), deps: unknown[]) => void;
    };
    useEffect(callback, [callback]);
  },
}));

jest.mock('@hooks/useNetwork', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@userActions/Profile', () => ({
  __esModule: true,
  fetchUsersData: jest.fn(),
}));

const mockedUseOnyx = jest.mocked(useOnyx);
const mockedUseNetwork = jest.mocked(useNetwork);
const mockedFetchUsersData = jest.mocked(Profile.fetchUsersData);

const FRIENDS = ['f1', 'f2'];
const NO_FRIENDS: string[] = [];

/** A persisted-looking cache entry for f1 (profile + status). */
const CACHED_LIST: UserDataList = {
  f1: {
    profile: {display_name: 'Friend One', photo_url: ''},
    user_status: {last_online: 1},
  },
} as unknown as UserDataList;

let mockIsOffline = false;
type FetchResult = Awaited<ReturnType<typeof Profile.fetchUsersData>>;
let resolveFetch: (value: FetchResult) => void;
let rejectFetch: (reason: unknown) => void;

function setOnyx(value: UserDataList | undefined): void {
  mockedUseOnyx.mockReturnValue([value, {status: 'loaded'}] as ReturnType<
    typeof useOnyx
  >);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSyncedThisAppRunForTests();
  mockIsOffline = false;
  mockedUseNetwork.mockImplementation(() => ({isOffline: mockIsOffline}));
  mockedFetchUsersData.mockImplementation(
    () =>
      new Promise<FetchResult>((resolve, reject) => {
        resolveFetch = resolve;
        rejectFetch = reject;
      }),
  );
  setOnyx(CACHED_LIST);
});

describe('useFriendsData cold-load gate', () => {
  it('holds the first open of an app run on the live sync even when a cache exists', async () => {
    const {result} = renderHook(() => useFriendsData(FRIENDS));

    // A persisted cache alone must NOT release the gate: painting it would
    // show last run's snapshot and reshuffle when fresh statuses land.
    expect(result.current.isLoading).toBe(true);
    expect(mockedFetchUsersData).toHaveBeenCalledWith(FRIENDS);

    await act(async () => {
      resolveFetch({profiles: {}, statuses: {}});
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('paints the cache instantly on later mounts of a synced run (stale-while-revalidate)', async () => {
    const first = renderHook(() => useFriendsData(FRIENDS));
    await act(async () => {
      resolveFetch({profiles: {}, statuses: {}});
    });
    first.unmount();

    const second = renderHook(() => useFriendsData(FRIENDS));

    // No gate on the revisit; the on-focus refresh still fires in the
    // background (one call per mount).
    expect(second.result.current.isLoading).toBe(false);
    expect(mockedFetchUsersData).toHaveBeenCalledTimes(2);
  });

  it('still gates the first-ever load with nothing cached', async () => {
    setOnyx(undefined);
    const {result} = renderHook(() => useFriendsData(FRIENDS));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.profileList).toEqual({});

    await act(async () => {
      resolveFetch({profiles: {}, statuses: {}});
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('paints the cache immediately when offline (nothing fresh can arrive)', () => {
    mockIsOffline = true;
    const {result} = renderHook(() => useFriendsData(FRIENDS));

    expect(result.current.isLoading).toBe(false);
    // The cache-derived maps are what gets painted.
    expect(result.current.profileList.f1).toBeDefined();
    expect(result.current.userStatusList.f1).toBeDefined();
  });

  it('releases the gate after the bounded wait when the sync is slow, without marking the run synced', () => {
    // The repo's setupAfterEnv runs on real timers; this test drives the
    // bounded-wait timer, so fake them locally and restore before cleanup.
    jest.useFakeTimers();
    try {
      const first = renderHook(() => useFriendsData(FRIENDS));
      expect(first.result.current.isLoading).toBe(true);

      act(() => {
        jest.advanceTimersByTime(CONST.TIMING.FRIENDS_COLD_SYNC_TIMEOUT);
      });

      // Timed out: fall back to the cached snapshot (pre-gate behavior).
      expect(first.result.current.isLoading).toBe(false);
      first.unmount();

      // The timeout must not count as a sync, so the next mount of this run
      // gates again and retries for freshness.
      const second = renderHook(() => useFriendsData(FRIENDS));
      expect(second.result.current.isLoading).toBe(true);
      second.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('releases the gate on a failed sync and does not re-gate later mounts', async () => {
    const first = renderHook(() => useFriendsData(FRIENDS));

    await act(async () => {
      rejectFetch(new Error('boom'));
    });

    // Degrade to the cached list rather than skeletons forever.
    expect(first.result.current.isLoading).toBe(false);
    first.unmount();

    // A settled (even failed) sync marks the run: no repeat gating while the
    // API is down. Data self-heals via the on-focus and reconnect refreshes.
    const second = renderHook(() => useFriendsData(FRIENDS));
    expect(second.result.current.isLoading).toBe(false);
  });

  it('never gates or fetches for an empty friend set', () => {
    const {result} = renderHook(() => useFriendsData(NO_FRIENDS));

    expect(result.current.isLoading).toBe(false);
    expect(mockedFetchUsersData).not.toHaveBeenCalled();
  });
});
