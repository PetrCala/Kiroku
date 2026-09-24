/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {act, renderHook} from '@testing-library/react-native';
import {useOnyx} from 'react-native-onyx';
import useSessionFeed from '@hooks/useSessionFeed';
import fetchSessionsPage from '@userActions/SessionFeed';
import ONYXKEYS from '@src/ONYXKEYS';
import type {SessionsPage} from '@src/types/onyx';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  useOnyx: jest.fn(),
  // The hook's imports reach modules that register Onyx listeners at load;
  // they must not throw, and nothing here reads what they subscribe to.
  default: {
    connect: jest.fn(),
    connectWithoutView: jest.fn(),
    METHOD: {MERGE: 'merge', SET: 'set'},
  },
}));

jest.mock('@userActions/SessionFeed', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseOnyx = jest.mocked(useOnyx);
const mockedFetch = jest.mocked(fetchSessionsPage);

const UID = 'u1';

type OnyxState = {
  sessions?: Record<string, {start_time: number}> | null;
  earliest?: number;
};

function setOnyx({sessions, earliest}: OnyxState): void {
  mockedUseOnyx.mockImplementation(((key: string) => {
    if (key === ONYXKEYS.CACHED_DRINKING_SESSIONS) {
      return [sessions === undefined ? undefined : {[UID]: sessions}];
    }
    if (key === ONYXKEYS.USER_DATA_LIST) {
      return [
        earliest === undefined ? {} : {[UID]: {earliest_session_at: earliest}},
      ];
    }
    return [undefined];
  }) as unknown as typeof useOnyx);
}

/** A fetch whose resolution the test controls. */
function deferredPage() {
  let resolve!: (page: SessionsPage | undefined) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<SessionsPage | undefined>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  mockedFetch.mockReturnValueOnce(promise);
  return {resolve, reject};
}

describe('useSessionFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the cached sessions newest first', () => {
    setOnyx({sessions: {old: {start_time: 1000}, recent: {start_time: 3000}}});
    const {result} = renderHook(() => useSessionFeed(UID));
    expect(result.current.items.map(item => item.sessionId)).toEqual([
      'recent',
      'old',
    ]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('asks for the page below the oldest loaded session', async () => {
    setOnyx({sessions: {old: {start_time: 1000}, recent: {start_time: 3000}}});
    const page = deferredPage();
    const {result} = renderHook(() => useSessionFeed(UID));

    act(() => result.current.loadMore());
    expect(mockedFetch).toHaveBeenCalledWith(UID, 1000);
    expect(result.current.isLoadingMore).toBe(true);

    // A second call while the first is in flight is dropped.
    act(() => result.current.loadMore());
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      page.resolve({nextCursor: 500, count: 20});
    });
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.hasMore).toBe(true);
  });

  it('asks for the newest page when nothing is loaded yet', () => {
    setOnyx({sessions: {}});
    deferredPage();
    const {result} = renderHook(() => useSessionFeed(UID));
    act(() => result.current.loadMore());
    expect(mockedFetch).toHaveBeenCalledWith(UID, undefined);
  });

  it('stops once the server says nothing is older than the cursor', async () => {
    setOnyx({sessions: {old: {start_time: 1000}}});
    const page = deferredPage();
    const {result} = renderHook(() => useSessionFeed(UID));

    act(() => result.current.loadMore());
    await act(async () => {
      page.resolve({nextCursor: null, count: 0});
    });
    expect(result.current.hasMore).toBe(false);

    act(() => result.current.loadMore());
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('resumes paging when the oldest loaded session changes after the end was reached', async () => {
    setOnyx({sessions: {old: {start_time: 1000}}});
    const page = deferredPage();
    const {result, rerender} = renderHook(() => useSessionFeed(UID));
    act(() => result.current.loadMore());
    await act(async () => {
      page.resolve({nextCursor: null, count: 0});
    });
    expect(result.current.hasMore).toBe(false);

    // A full re-baseline shrank the map to the boot window: the cursor moved.
    setOnyx({sessions: {recent: {start_time: 3000}}});
    rerender({});
    expect(result.current.hasMore).toBe(true);
  });

  it('stops without a round trip once the oldest loaded session reaches earliest_session_at', () => {
    setOnyx({sessions: {first: {start_time: 1000}}, earliest: 1000});
    const {result} = renderHook(() => useSessionFeed(UID));
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('does not treat a discarded (offline) or failed page as the end', async () => {
    setOnyx({sessions: {old: {start_time: 1000}}});
    const discarded = deferredPage();
    const {result} = renderHook(() => useSessionFeed(UID));
    act(() => result.current.loadMore());
    await act(async () => {
      discarded.resolve(undefined);
    });
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoadingMore).toBe(false);

    const failed = deferredPage();
    act(() => result.current.loadMore());
    await act(async () => {
      failed.reject(new Error('network'));
    });
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('has nothing to page before the snapshot arrives or without a user', () => {
    setOnyx({});
    const {result} = renderHook(() => useSessionFeed(UID));
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);

    setOnyx({sessions: {old: {start_time: 1000}}});
    const {result: anonymous} = renderHook(() => useSessionFeed(undefined));
    expect(anonymous.current.hasMore).toBe(false);
  });
});
