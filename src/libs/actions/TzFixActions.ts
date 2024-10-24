import Onyx from 'react-native-onyx';
import Navigation from '@libs/Navigation/Navigation';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import {TzFixStep} from '@src/types/onyx/TzFix';

/**
 * Clear 2FA data if the flow is interrupted without finishing
 */
function clearTwoFactorAuthData() {
  Onyx.merge(ONYXKEYS.NVP_TZ_FIX, {
    hasCompletedGuidedSetupFlow: false,
    tzFixStep: null,
  });
}
function setTwoFactorAuthStep(tzFixStep: TzFixStep) {
  Onyx.merge(ONYXKEYS.NVP_TZ_FIX, {tzFixStep: tzFixStep as any});
}

function setHasCompletedGuidedSetupFlow() {
  Onyx.merge(ONYXKEYS.NVP_TZ_FIX, {hasCompletedGuidedSetupFlow: true});
}

function quitAndNavigateBack(backTo?: Route) {
  clearTwoFactorAuthData();
  Navigation.goBack(backTo);
}

export {
  clearTwoFactorAuthData,
  setTwoFactorAuthStep,
  setHasCompletedGuidedSetupFlow,
  quitAndNavigateBack,
};
