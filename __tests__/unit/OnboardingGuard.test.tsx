/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {render} from '@testing-library/react-native';
import React from 'react';
import OnboardingGuard from '@libs/Navigation/guards/OnboardingGuard';
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

describe('OnboardingGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetActiveRoute.mockReturnValue('/home');
    mockedIsNavigationReady.mockReturnValue(Promise.resolve());
  });

  test('navigates to currentOnboardingRoute when fire-ready', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    render(<OnboardingGuard />);
    await flushAsync();

    expect(mockedNavigate).toHaveBeenCalledWith(ROUTES.ONBOARDING_TERMS);
  });

  test('resumes lastVisitedPath when it points inside onboarding/', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
      lastVisitedPath: ROUTES.ONBOARDING_DISPLAY_NAME,
    });

    render(<OnboardingGuard />);
    await flushAsync();

    expect(mockedNavigate).toHaveBeenCalledWith(ROUTES.ONBOARDING_DISPLAY_NAME);
  });

  test('falls back to currentOnboardingRoute when lastVisitedPath is non-onboarding', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_DISPLAY_NAME,
      lastVisitedPath: '/home',
    });

    render(<OnboardingGuard />);
    await flushAsync();

    expect(mockedNavigate).toHaveBeenCalledWith(ROUTES.ONBOARDING_DISPLAY_NAME);
  });

  test('does not navigate when shouldFireOnboarding is false', async () => {
    setFlow({shouldFireOnboarding: false, currentOnboardingRoute: null});

    render(<OnboardingGuard />);
    await flushAsync();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test('does not navigate while not yet ready', async () => {
    setFlow({
      isReady: false,
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    render(<OnboardingGuard />);
    await flushAsync();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test('skips navigation when already on an onboarding path', async () => {
    mockedGetActiveRoute.mockReturnValue(`/${ROUTES.ONBOARDING_TERMS}`);
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    render(<OnboardingGuard />);
    await flushAsync();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test('debounces: re-rendering with the same target does not re-navigate', async () => {
    setFlow({
      shouldFireOnboarding: true,
      currentOnboardingRoute: ROUTES.ONBOARDING_TERMS,
    });

    const {rerender} = render(<OnboardingGuard />);
    await flushAsync();
    rerender(<OnboardingGuard />);
    await flushAsync();

    expect(mockedNavigate).toHaveBeenCalledTimes(1);
  });
});
