/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {render} from '@testing-library/react-native';
import React from 'react';
import OnboardingGuard, {
  NAVIGATE_SETTLE_MS,
} from '@libs/Navigation/guards/OnboardingGuard';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';

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
  default: {
    current: {
      addListener: jest.fn(() => jest.fn()),
    },
  },
}));

const mockedUseOnboardingFlow = jest.mocked(useOnboardingFlow);
const mockedNavigate = jest.mocked(Navigation.navigate);
const mockedGetActiveRoute = jest.mocked(Navigation.getActiveRoute);
const mockedIsNavigationReady = jest.mocked(Navigation.isNavigationReady);

function setFlow(
  overrides: Partial<ReturnType<typeof useOnboardingFlow>>,
): void {
  mockedUseOnboardingFlow.mockReturnValue({
    isReady: true,
    shouldFireOnboarding: true,
    currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    lastVisitedPath: undefined,
    skipOnboarding: false,
    ...overrides,
  });
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Run the guard's full navigate pipeline: flush the `isNavigationReady`
 * continuation (which schedules the settle timer), elapse the settle window,
 * and flush again so the navigate (if any) has executed.
 */
async function elapseSettleWindow(): Promise<void> {
  await flushAsync();
  jest.advanceTimersByTime(NAVIGATE_SETTLE_MS);
  await flushAsync();
}

describe('OnboardingGuard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockedGetActiveRoute.mockReturnValue('/home');
    mockedIsNavigationReady.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('navigates to currentOnboardingRoute when fire-ready', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    render(<OnboardingGuard />);
    await elapseSettleWindow();

    expect(mockedNavigate).toHaveBeenCalledWith(ROUTES.ONBOARDING_TERMS);
  });

  test('resumes lastVisitedPath when it points inside onboarding/', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
      lastVisitedPath: ROUTES.ONBOARDING_DISPLAY_NAME,
    });

    render(<OnboardingGuard />);
    await elapseSettleWindow();

    expect(mockedNavigate).toHaveBeenCalledWith(ROUTES.ONBOARDING_DISPLAY_NAME);
  });

  test('falls back to currentOnboardingRoute when lastVisitedPath is non-onboarding', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_DISPLAY_NAME,
      lastVisitedPath: '/home',
    });

    render(<OnboardingGuard />);
    await elapseSettleWindow();

    expect(mockedNavigate).toHaveBeenCalledWith(ROUTES.ONBOARDING_DISPLAY_NAME);
  });

  test('does not navigate when shouldFireOnboarding is false', async () => {
    setFlow({shouldFireOnboarding: false, currentOnboardingRoute: null});

    render(<OnboardingGuard />);
    await elapseSettleWindow();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test('does not navigate while not yet ready', async () => {
    setFlow({
      isReady: false,
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    render(<OnboardingGuard />);
    await elapseSettleWindow();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test('skips navigation when already on an onboarding path', async () => {
    mockedGetActiveRoute.mockReturnValue(`/${ROUTES.ONBOARDING_TERMS}`);
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    render(<OnboardingGuard />);
    await elapseSettleWindow();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test('cancels a queued navigate when the flow flips to false before navigation is ready', async () => {
    // Hold navigation "not ready" so the navigate stays queued in the
    // isNavigationReady continuation.
    let resolveReady: () => void = () => {};
    mockedIsNavigationReady.mockReturnValue(
      new Promise<void>(resolve => {
        resolveReady = resolve;
      }),
    );
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    const {rerender} = render(<OnboardingGuard />);

    // The store settles (e.g. the complete record finishes loading) before
    // navigation becomes ready: the flow flips to "don't fire". The queued
    // navigate from the transient fire-render must NOT execute afterwards —
    // entering onboarding is one-way, so it would strand the user.
    setFlow({shouldFireOnboarding: false, currentOnboardingRoute: null});
    rerender(<OnboardingGuard />);

    resolveReady();
    await elapseSettleWindow();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test('cancels a pending navigate when the flow flips to false during the settle window', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    const {rerender} = render(<OnboardingGuard />);
    // The isNavigationReady continuation runs and schedules the settle timer.
    await flushAsync();
    jest.advanceTimersByTime(NAVIGATE_SETTLE_MS - 1);

    // The Onyx commit race: `IS_LOADING_APP=false` notified first and produced
    // a transient fire decision; the full user record commits a beat later and
    // flips the flow back. The pending navigate must be cancelled.
    setFlow({shouldFireOnboarding: false, currentOnboardingRoute: null});
    rerender(<OnboardingGuard />);

    jest.advanceTimersByTime(NAVIGATE_SETTLE_MS + 1);
    await flushAsync();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test('debounces: re-rendering with the same target does not re-navigate', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    const {rerender} = render(<OnboardingGuard />);
    await elapseSettleWindow();
    rerender(<OnboardingGuard />);
    await elapseSettleWindow();

    expect(mockedNavigate).toHaveBeenCalledTimes(1);
  });
});
