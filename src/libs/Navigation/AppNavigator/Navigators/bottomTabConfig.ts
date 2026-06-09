import type {ComponentType} from 'react';
import type {ImageSourcePropType} from 'react-native';
import type {SFSymbol} from 'sf-symbols-typescript';
import HomeTabIcon from '@assets/images/tab-bar-icons/home.png';
import FriendsTabIcon from '@assets/images/tab-bar-icons/friends.png';
import StatisticsTabIcon from '@assets/images/tab-bar-icons/statistics.png';
import SettingsTabIcon from '@assets/images/tab-bar-icons/settings.png';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import type {BottomTabName} from '@navigation/types';
import type {TranslationPaths} from '@src/languages/types';
import SCREENS from '@src/SCREENS';
import type IconAsset from '@src/types/utils/IconAsset';
import type ReactComponentModule from '@src/types/utils/ReactComponentModule';

/**
 * A single bottom-tab definition shared by the native (`react-native-bottom-tabs`)
 * and web (`@react-navigation/bottom-tabs` custom bar) navigators, so the two
 * platform implementations never drift on which tabs exist, their order, their
 * labels, or their icons.
 */
type BottomTabConfigItem = {
  /** Screen name registered in the bottom tab navigator. Also the tab route name. */
  name: BottomTabName;

  /** Lazily-loaded screen component for the tab root. */
  getComponent: () => ComponentType;

  /** Localized label key (en.ts is the source of truth). */
  labelKey: TranslationPaths;

  /** SF Symbol rendered by the native iOS tab bar (Liquid Glass). */
  sfSymbol: SFSymbol;

  /** Raster icon for the native Android (Material) tab bar — the app's SVG
   *  `Icon` components cannot be rendered inside a native tab bar. */
  androidIcon: ImageSourcePropType;

  /** In-app SVG icon used by the web custom tab bar (rendered via `Icon`). */
  webIcon: IconAsset;
};

const BOTTOM_TAB_CONFIG: BottomTabConfigItem[] = [
  {
    name: SCREENS.HOME,
    getComponent: () =>
      require<ReactComponentModule>('@screens/HomeScreen').default,
    labelKey: 'bottomTabBar.home',
    sfSymbol: 'calendar',
    androidIcon: HomeTabIcon,
    webIcon: KirokuIcons.Calendar,
  },
  {
    name: SCREENS.SOCIAL.ROOT,
    getComponent: () =>
      require<ReactComponentModule>('@screens/Social/SocialScreen').default,
    labelKey: 'bottomTabBar.friends',
    sfSymbol: 'person.2.fill',
    androidIcon: FriendsTabIcon,
    webIcon: KirokuIcons.Users,
  },
  {
    name: SCREENS.STATISTICS.ROOT,
    getComponent: () =>
      require<ReactComponentModule>('@screens/Statistics/StatisticsScreen')
        .default,
    labelKey: 'bottomTabBar.statistics',
    sfSymbol: 'chart.bar.fill',
    androidIcon: StatisticsTabIcon,
    webIcon: KirokuIcons.Statistics,
  },
  {
    name: SCREENS.SETTINGS.ROOT,
    getComponent: () =>
      require<ReactComponentModule>('@screens/Settings/SettingsScreen').default,
    labelKey: 'bottomTabBar.settings',
    sfSymbol: 'gearshape.fill',
    androidIcon: SettingsTabIcon,
    webIcon: KirokuIcons.Settings,
  },
];

export default BOTTOM_TAB_CONFIG;
export type {BottomTabConfigItem};
