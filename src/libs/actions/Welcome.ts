import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {TzFix} from '@src/types/onyx';
import type Onboarding from '@src/types/onyx/Onboarding';
// import type TryNewDot from '@src/types/onyx/TryNewDot';

type OnboardingData = Onboarding | [] | undefined;
type TzFixData = TzFix | [] | undefined;

let isLoadingReportData = true;
// let tryNewDotData: TryNewDot | undefined;
let onboarding: OnboardingData;
let tzFix: TzFixData;

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

let resolveTryNewDotStatus: (value?: Promise<void>) => void | undefined;
const tryNewDotStatusPromise = new Promise<void>(resolve => {
  resolveTryNewDotStatus = resolve;
});

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
  if (isLoadingReportData) {
    return;
  }

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

// Onyx.connect({
//   key: ONYXKEYS.NVP_ONBOARDING,
//   callback: value => {
//     onboarding = value;
//     checkOnboardingDataReady();
//   },
// });

function resetAllChecks() {
  isServerDataReadyPromise = new Promise(resolve => {
    resolveIsReadyPromise = resolve;
  });
  isOnboardingFlowStatusKnownPromise = new Promise<void>(resolve => {
    resolveOnboardingFlowStatus = resolve;
  });
  isLoadingReportData = true;
}

export {
  onServerDataReady,
  isOnboardingFlowCompleted,
  isTzFixFlowCompleted,
  resetAllChecks,
};
