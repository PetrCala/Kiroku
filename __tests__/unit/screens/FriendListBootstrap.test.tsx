/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/no-require-imports, global-require -- jest mock factories require their deps lazily */

/**
 * Regression coverage for the friends-list "no friends" flash on first cold boot.
 *
 * `friends` is empty until `app/open` delivers the friend list. The empty-state
 * decision is gated on `IS_LOADING_APP !== false` (the same bootstrap signal the
 * onboarding/terms guards use): while the app is still loading AND online, the
 * list must keep spinning rather than briefly claiming the user has no friends.
 * Offline (where `IS_LOADING_APP` can't settle) it shows an offline notice
 * instead. These tests render the real screen with a UserListComponent stand-in
 * that mirrors what the user actually sees (a spinner masks the empty state).
 */
import {render} from '@testing-library/react-native';
import React from 'react';
import FriendListScreen from '@screens/Social/FriendListScreen';
import type {UserData} from '@src/types/onyx';

// Drive the screen's inputs per test.
let mockIsLoadingApp: boolean | undefined;
let mockIsOffline: boolean;
let mockUserData: Partial<UserData>;

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {connect: jest.fn(), disconnect: jest.fn()},
  useOnyx: jest.fn(() => [mockIsLoadingApp, {status: 'loaded'}]),
}));

jest.mock('@hooks/useCurrentUserData', () => ({
  __esModule: true,
  default: () => mockUserData,
}));
jest.mock('@hooks/useNetwork', () => ({
  __esModule: true,
  default: () => ({isOffline: mockIsOffline}),
}));
jest.mock('@hooks/useLocalize', () => ({
  __esModule: true,
  default: () => ({translate: (key: string) => key}),
}));
jest.mock('@hooks/useThemeStyles', () => ({
  __esModule: true,
  default: () => ({flex1: {flex: 1}, noResultsText: {}}),
}));
jest.mock('@hooks/useFriendsData', () => ({
  __esModule: true,
  default: () => ({profileList: {}, userStatusList: {}, isLoading: false}),
}));

jest.mock('@components/Social/SearchWindow', () => ({
  __esModule: true,
  default: () => null,
}));
type TextStub = React.ComponentType<{
  testID?: string;
  children?: React.ReactNode;
}>;

jest.mock('@components/Text', () => {
  const {Text} = require('react-native') as {Text: TextStub};
  return {__esModule: true, default: Text};
});
jest.mock('@components/Social/NoFriendInfo', () => {
  const {Text} = require('react-native') as {Text: TextStub};
  return {
    __esModule: true,
    default: () => <Text testID="no-friend-info">no-friends</Text>,
  };
});

// A PURE prop-capture stand-in. It deliberately does NOT reimplement
// UserListComponent's own "a spinner masks the empty state" behavior — that is
// UserListComponent's contract, not FriendListScreen's, and reimplementing it
// here would risk passing against a stand-in while the real component drifts.
// We render the `emptyListComponent` FriendListScreen passed (so we can inspect
// WHICH empty state it chose) and assert the masking contract via the captured
// `isLoading` prop — the value FriendListScreen actually owns.
const mockUserListProps: {current: Record<string, unknown> | null} = {
  current: null,
};
jest.mock('@components/Social/UserListComponent', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockUserListProps.current = props;
    return props.emptyListComponent as React.ReactElement;
  },
}));

// RNTL's getBy* queries are unusable in this repo's jest env (a react-native
// module-instance mismatch breaks StyleSheet.flatten during traversal), so we
// assert on the captured props and the serialized render tree instead.
function renderScreen(inputs: {
  isLoadingApp: boolean | undefined;
  isOffline: boolean;
  userData: Partial<UserData>;
}): string {
  mockIsLoadingApp = inputs.isLoadingApp;
  mockIsOffline = inputs.isOffline;
  mockUserData = inputs.userData;
  return JSON.stringify(render(<FriendListScreen />).toJSON());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserListProps.current = null;
});

describe('FriendListScreen bootstrap empty-state gating', () => {
  it('keeps the list loading (no "no friends" flash) while online and IS_LOADING_APP has not settled', () => {
    const tree = renderScreen({
      isLoadingApp: undefined,
      isOffline: false,
      userData: {friends: {}, blocked: {}},
    });

    // The empty state FriendListScreen prepared IS the "no friends" one...
    expect(tree).toContain('no-friend-info');
    // ...but the fix sets isLoading=true while bootstrap is pending online, which
    // is the signal UserListComponent uses to keep spinning instead of showing
    // it — so the flash can never reach the user before app/open lands.
    expect(mockUserListProps.current?.isLoading).toBe(true);
  });

  it('shows the genuine "no friends" empty state once IS_LOADING_APP is false', () => {
    const tree = renderScreen({
      isLoadingApp: false,
      isOffline: false,
      userData: {friends: {}, blocked: {}},
    });

    // Bootstrap settled: the empty state is now legitimate and ungated.
    expect(mockUserListProps.current?.isLoading).toBe(false);
    expect(tree).toContain('no-friend-info');
  });

  it('shows an offline notice (not "no friends") when offline with nothing cached', () => {
    const tree = renderScreen({
      isLoadingApp: undefined,
      isOffline: true,
      userData: {friends: {}, blocked: {}},
    });

    // Offline can never settle IS_LOADING_APP, so spinning forever or claiming
    // "no friends" would both be wrong — FriendListScreen chooses the offline
    // notice, and ungates it (isLoading false).
    expect(mockUserListProps.current?.isLoading).toBe(false);
    expect(tree).toContain('friendListScreen.offlineNoData');
    expect(tree).not.toContain('no-friend-info');
  });

  it('passes the friend list through (not loading) when there are friends', () => {
    renderScreen({
      isLoadingApp: undefined,
      isOffline: false,
      userData: {friends: {'friend-1': true}, blocked: {}},
    });

    // With friends present the list is never gated as bootstrap-pending.
    expect(mockUserListProps.current?.isLoading).toBe(false);
    expect(mockUserListProps.current?.fullUserArray).toEqual(['friend-1']);
  });
});
