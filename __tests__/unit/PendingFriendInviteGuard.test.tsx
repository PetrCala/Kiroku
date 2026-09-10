/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {render} from '@testing-library/react-native';
import React from 'react';
import {useOnyx} from 'react-native-onyx';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import {NAVIGATE_SETTLE_MS} from '@libs/Navigation/guards/OnboardingGuard';
import PendingFriendInviteGuard from '@libs/Navigation/guards/PendingFriendInviteGuard';
import Navigation from '@libs/Navigation/Navigation';
import {clearPendingInvite} from '@userActions/FriendInvite';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {PendingFriendInvite} from '@src/types/onyx';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  useOnyx: jest.fn(),
  default: {connect: jest.fn(), set: jest.fn()},
}));

jest.mock('@hooks/useOnboardingFlow', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {
    navigate: jest.fn(),
    getActiveRoute: jest.fn(),
    isNavigationReady: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@libs/Navigation/navigationRef', () => ({
  __esModule: true,
  default: {current: {addListener: jest.fn(() => jest.fn())}},
}));

jest.mock('@userActions/FriendInvite', () => ({
  clearPendingInvite: jest.fn(),
}));

jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {info: jest.fn(), hmmm: jest.fn(), warn: jest.fn()},
}));

const mockedUseOnyx = jest.mocked(useOnyx);
const mockedUseOnboardingFlow = jest.mocked(useOnboardingFlow);
const mockedNavigate = jest.mocked(Navigation.navigate);
const mockedGetActiveRoute = jest.mocked(Navigation.getActiveRoute);
const mockedClear = jest.mocked(clearPendingInvite);

const NOW = 1_800_000_000_000;
const CODE = 'abcd234567';

function setPending(pending: PendingFriendInvite | undefined) {
  mockedUseOnyx.mockReturnValue([
    pending,
    {status: 'loaded'},
  ] as unknown as ReturnType<typeof useOnyx>);
}

function setFlow(overrides: Partial<ReturnType<typeof useOnboardingFlow>>) {
  mockedUseOnboardingFlow.mockReturnValue({
    isReady: true,
    shouldFireOnboarding: false,
    currentOnboardingRoute: null,
    lastVisitedPath: undefined,
    skipOnboarding: false,
    ...overrides,
  });
}

async function settle(windows = 1) {
  await Promise.resolve();
  await Promise.resolve();
  for (let i = 0; i < windows; i++) {
    jest.advanceTimersByTime(NAVIGATE_SETTLE_MS);
  }
}

describe('PendingFriendInviteGuard', () => {
  // Inside the describe so these run before RNTL's top-level cleanup hook,
  // which would otherwise unmount under fake timers and hang.
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
    mockedGetActiveRoute.mockReturnValue('/home');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reopens the invite once signed in and onboarded, then clears it', async () => {
    setPending({code: CODE, createdAt: NOW - 1000});
    setFlow({});
    render(<PendingFriendInviteGuard />);
    await settle();
    expect(mockedClear).toHaveBeenCalled();
    expect(mockedNavigate).toHaveBeenCalledWith(
      ROUTES.ADD_FRIEND.getRoute(CODE),
    );
  });

  it('does nothing without a stashed invite', async () => {
    setPending(undefined);
    setFlow({});
    render(<PendingFriendInviteGuard />);
    await settle();
    expect(mockedNavigate).not.toHaveBeenCalled();
    expect(mockedClear).not.toHaveBeenCalled();
  });

  it('waits while onboarding still has to run', async () => {
    setPending({code: CODE, createdAt: NOW - 1000});
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });
    render(<PendingFriendInviteGuard />);
    await settle(3);
    expect(mockedNavigate).not.toHaveBeenCalled();
    expect(mockedClear).not.toHaveBeenCalled();
  });

  it('waits while the app is still loading', async () => {
    setPending({code: CODE, createdAt: NOW - 1000});
    setFlow({isReady: false});
    render(<PendingFriendInviteGuard />);
    await settle(3);
    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  it('holds off while an onboarding route is still on screen', async () => {
    setPending({code: CODE, createdAt: NOW - 1000});
    setFlow({});
    mockedGetActiveRoute.mockReturnValue(`/${ROUTES.ONBOARDING_TERMS}`);
    render(<PendingFriendInviteGuard />);
    await settle();
    expect(mockedNavigate).not.toHaveBeenCalled();
    // The onboarding modal finishes closing; the next settle window fires.
    mockedGetActiveRoute.mockReturnValue('/home');
    jest.advanceTimersByTime(NAVIGATE_SETTLE_MS);
    expect(mockedNavigate).toHaveBeenCalledWith(
      ROUTES.ADD_FRIEND.getRoute(CODE),
    );
  });

  it('drops a stale invite without navigating', async () => {
    setPending({
      code: CODE,
      createdAt: NOW - CONST.FRIEND_INVITE.PENDING_TTL_MS - 1,
    });
    setFlow({});
    render(<PendingFriendInviteGuard />);
    await settle();
    expect(mockedClear).toHaveBeenCalled();
    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  it('only clears when the invite screen is already open', async () => {
    setPending({code: CODE, createdAt: NOW - 1000});
    setFlow({});
    mockedGetActiveRoute.mockReturnValue(
      `/${ROUTES.ADD_FRIEND.getRoute(CODE)}`,
    );
    render(<PendingFriendInviteGuard />);
    await settle();
    expect(mockedClear).toHaveBeenCalled();
    expect(mockedNavigate).not.toHaveBeenCalled();
  });
});
