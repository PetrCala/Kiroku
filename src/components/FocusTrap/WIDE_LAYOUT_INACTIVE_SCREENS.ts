import NAVIGATORS from '@src/NAVIGATORS';
import SCREENS from '@src/SCREENS';

/**
 * Screens displayed in the BottomTab and CentralPane displayed side by side that should not have active
 * focus trap when rendered on a wide screen to allow navigation between them using the keyboard
 */
const WIDE_LAYOUT_INACTIVE_SCREENS: string[] = [
  NAVIGATORS.BOTTOM_TAB_NAVIGATOR,
  SCREENS.HOME,
  SCREENS.SETTINGS.ROOT,
  SCREENS.SETTINGS.ROOT,
  SCREENS.SETTINGS.ACCOUNT.ROOT,
  SCREENS.SETTINGS.PREFERENCES.ROOT,
  // ...
];

export default WIDE_LAYOUT_INACTIVE_SCREENS;
