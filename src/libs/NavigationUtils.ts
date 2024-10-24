import SCREENS from '@src/SCREENS';
import type {CentralPaneName} from './Navigation/types';

const CENTRAL_PANE_SCREEN_NAMES = new Set([
  SCREENS.HOME,
  SCREENS.SETTINGS.ACCOUNT.ROOT,
  SCREENS.SETTINGS.PREFERENCES.ROOT,
  // SCREENS.SETTINGS.WORKSPACES,
  // SCREENS.SETTINGS.PREFERENCES.ROOT,
  // SCREENS.SETTINGS.SECURITY,
  // ...  -
]);

const ONBOARDING_SCREEN_NAMES = new Set([
  //   SCREENS.ONBOARDING.PERSONAL_DETAILS,
  //   SCREENS.ONBOARDING.PURPOSE,
  //   SCREENS.ONBOARDING.WORK,
  //   SCREENS.ONBOARDING_MODAL.ONBOARDING,
]);

function isCentralPaneName(
  screen: string | undefined,
): screen is CentralPaneName {
  if (!screen) {
    return false;
  }
  return CENTRAL_PANE_SCREEN_NAMES.has(screen as CentralPaneName);
}

export {isCentralPaneName};
