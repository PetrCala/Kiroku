import type {BottomTabName, CentralPaneName} from '@navigation/types';
import SCREENS from '@src/SCREENS';

const TAB_TO_CENTRAL_PANE_MAPPING: Record<BottomTabName, CentralPaneName[]> = {
  [SCREENS.HOME]: [SCREENS.HOME],
  //   [SCREENS.SEARCH.BOTTOM_TAB]: [SCREENS.SEARCH.CENTRAL_PANE],
  //   [SCREENS.SETTINGS.ROOT]: [
  //     SCREENS.SETTINGS.PROFILE.ROOT,
  //     SCREENS.SETTINGS.PREFERENCES.ROOT,
  //     SCREENS.SETTINGS.SECURITY,
  //     SCREENS.SETTINGS.WALLET.ROOT,
  //     SCREENS.SETTINGS.ABOUT,
  //     SCREENS.SETTINGS.WORKSPACES,
  //     SCREENS.SETTINGS.SAVE_THE_WORLD,
  //     SCREENS.SETTINGS.TROUBLESHOOT,
  //     SCREENS.SETTINGS.SUBSCRIPTION.ROOT,
  //   ],
};

const generateCentralPaneToTabMapping = (): Record<
  CentralPaneName,
  BottomTabName
> => {
  const mapping: Record<CentralPaneName, BottomTabName> = {} as Record<
    CentralPaneName,
    BottomTabName
  >;
  for (const [tabName, CentralPaneNames] of Object.entries(
    TAB_TO_CENTRAL_PANE_MAPPING,
  )) {
    for (const CentralPaneName of CentralPaneNames) {
      mapping[CentralPaneName] = tabName as BottomTabName;
    }
  }
  return mapping;
};

const CENTRAL_PANE_TO_TAB_MAPPING: Record<CentralPaneName, BottomTabName> =
  generateCentralPaneToTabMapping();

export {CENTRAL_PANE_TO_TAB_MAPPING};
export default TAB_TO_CENTRAL_PANE_MAPPING;
