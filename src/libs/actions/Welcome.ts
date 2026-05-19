import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {OnboardingData as OnboardingNvp} from '@src/types/onyx';
// import type TryNewDot from '@src/types/onyx/TryNewDot';

type OnboardingNvpData = OnboardingNvp | [] | undefined;

// let tryNewDotData: TryNewDot | undefined;
let onboarding: OnboardingNvpData;
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
    if (Array.isArray(onboarding) || onboarding?.completed_at === undefined) {
      return;
    }

    if (onboarding?.completed_at) {
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
  key: ONYXKEYS.NVP_ONBOARDING,
  callback: value => {
    onboarding = value;
    checkOnboardingDataReady();
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
  resetAllChecks,
};
