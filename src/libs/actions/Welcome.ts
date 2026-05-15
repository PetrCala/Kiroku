import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {OnboardingData as OnboardingNvp, TzFix} from '@src/types/onyx';
import type Onboarding from '@src/types/onyx/Onboarding';
// import type TryNewDot from '@src/types/onyx/TryNewDot';

type OnboardingData = Onboarding | [] | undefined;
type TzFixData = TzFix | [] | undefined;
type OnboardingNvpData = OnboardingNvp | [] | undefined;

// let tryNewDotData: TryNewDot | undefined;
// TODO(#352+): the legacy `onboarding` var is fed by NVP_TZ_FIX below — a
// pre-existing wiring bug. Clean up when the tzFix flow is rewritten.
let onboarding: OnboardingData;
let tzFix: TzFixData;
// Consumed by later issues in the onboarding rebuild epic (#352+).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let onboardingData: OnboardingNvpData;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let termsAcceptedVersion: number | undefined;

type HasCompletedOnboardingFlowProps = {
  onCompleted?: () => void;
  onNotCompleted?: () => void;
};

let resolveIsReadyPromise: (value?: Promise<void>) => void | undefined;
let isServerDataReadyPromise = new Promise<void>(resolve => {
  resolveIsReadyPromise = resolve;
});

let resolveOnboardingFlowStatus: () => void;
let isOnboardingFlowStatusKnownPromise = new Promise<void>(resolve => {
  resolveOnboardingFlowStatus = resolve;
});

// let resolveTryNewDotStatus: (value?: Promise<void>) => void | undefined;
// const tryNewDotStatusPromise = new Promise<void>(resolve => {
//   resolveTryNewDotStatus = resolve;
// });

function onServerDataReady(): Promise<void> {
  return isServerDataReadyPromise;
}

function isOnboardingFlowCompleted({
  onCompleted,
  onNotCompleted,
}: HasCompletedOnboardingFlowProps) {
  isOnboardingFlowStatusKnownPromise.then(() => {
    if (
      Array.isArray(onboarding) ||
      onboarding?.hasCompletedGuidedSetupFlow === undefined
    ) {
      return;
    }

    if (onboarding?.hasCompletedGuidedSetupFlow) {
      onCompleted?.();
    } else {
      onNotCompleted?.();
    }
  });
}

function isTzFixFlowCompleted({
  onCompleted,
  onNotCompleted,
}: HasCompletedOnboardingFlowProps) {
  isOnboardingFlowStatusKnownPromise.then(() => {
    if (
      Array.isArray(tzFix) ||
      tzFix?.hasCompletedGuidedSetupFlow === undefined
    ) {
      return;
    }

    if (tzFix?.hasCompletedGuidedSetupFlow) {
      onCompleted?.();
    } else {
      onNotCompleted?.();
    }
  });
}

/**
 * Check if report data are loaded
 */
function checkServerDataReady() {
  // if (isLoadingReportData) {
  //   return;
  // }

  resolveIsReadyPromise?.();
}

/**
 * Check if the onboarding data is loaded
 */
function checkOnboardingDataReady() {
  if (onboarding === undefined) {
    return;
  }

  resolveOnboardingFlowStatus();
}

// function setOnboardingPurposeSelected(value: OnboardingPurposeType) {
//   Onyx.set(ONYXKEYS.ONBOARDING_PURPOSE_SELECTED, value ?? null);
// }

// function setOnboardingErrorMessage(value: string) {
//   Onyx.set(ONYXKEYS.ONBOARDING_ERROR_MESSAGE, value ?? null);
// }

Onyx.connect({
  key: ONYXKEYS.NVP_TZ_FIX,
  callback: value => {
    onboarding = value;
    checkOnboardingDataReady();
  },
});

Onyx.connect({
  key: ONYXKEYS.NVP_ONBOARDING,
  callback: value => {
    onboardingData = value;
  },
});

Onyx.connect({
  key: ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION,
  callback: value => {
    termsAcceptedVersion = value;
  },
});

function resetAllChecks() {
  isServerDataReadyPromise = new Promise(resolve => {
    resolveIsReadyPromise = resolve;
  });
  isOnboardingFlowStatusKnownPromise = new Promise<void>(resolve => {
    resolveOnboardingFlowStatus = resolve;
  });
}

export {
  checkServerDataReady,
  onServerDataReady,
  isOnboardingFlowCompleted,
  isTzFixFlowCompleted,
  resetAllChecks,
};
