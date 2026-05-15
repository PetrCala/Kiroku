import type {ParamListBase} from '@react-navigation/routers';
import type {StackNavigationOptions} from '@react-navigation/stack';
import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import type {ThemeStyles} from '@styles/index';
import type {Screen} from '@src/SCREENS';
import SCREENS from '@src/SCREENS';
import type {
  AchievementsNavigatorParamList,
  DayOverviewNavigatorParamList,
  DrinkingSessionNavigatorParamList,
  ProfileNavigatorParamList,
  SettingsNavigatorParamList,
  SocialNavigatorParamList,
  StatisticsNavigatorParamList,
} from '@navigation/types';
import type ReactComponentModule from '@src/types/utils/ReactComponentModule';
import useModalScreenOptions from './useModalScreenOptions';

type Screens = Partial<Record<Screen, () => React.ComponentType>>;

/**
 * Create a modal stack navigator with an array of sub-screens.
 *
 * @param screens key/value pairs where the key is the name of the screen and the value is a functon that returns the lazy-loaded component
 * @param getScreenOptions optional function that returns the screen options, override the default options
 */
function createModalStackNavigator<TStackParams extends ParamListBase>(
  screens: Screens,
  getScreenOptions?: (styles: ThemeStyles) => StackNavigationOptions,
): React.ComponentType {
  const ModalStackNavigator = createStackNavigator<TStackParams>();

  function ModalStack() {
    const screenOptions = useModalScreenOptions(getScreenOptions);

    return (
      <ModalStackNavigator.Navigator screenOptions={screenOptions}>
        {Object.keys(screens as Required<Screens>).map(name => (
          <ModalStackNavigator.Screen
            key={name}
            name={name}
            getComponent={(screens as Required<Screens>)[name as Screen]}
          />
        ))}
      </ModalStackNavigator.Navigator>
    );
  }

  ModalStack.displayName = 'ModalStack';

  return ModalStack;
}

const AchievementsModalStackNavigator =
  createModalStackNavigator<AchievementsNavigatorParamList>({
    [SCREENS.ACHIEVEMENTS.ROOT]: () =>
      require<ReactComponentModule>('@screens/Achievements/AchievementsScreen')
        .default,
  });

const DayOverviewModalStackNavigator =
  createModalStackNavigator<DayOverviewNavigatorParamList>({
    [SCREENS.DAY_OVERVIEW.ROOT]: () =>
      require<ReactComponentModule>('@screens/DayOverview/DayOverviewScreen')
        .default,
  });

const DrinkingSessionModalStackNavigator =
  createModalStackNavigator<DrinkingSessionNavigatorParamList>({
    [SCREENS.DRINKING_SESSION.ROOT]: () =>
      require<ReactComponentModule>('@screens/DrinkingSession/DrinkingSessionScreen')
        .default,
    [SCREENS.DRINKING_SESSION.LIVE]: () =>
      require<ReactComponentModule>('@screens/DrinkingSession/LiveSessionScreen')
        .default,
    [SCREENS.DRINKING_SESSION.EDIT]: () =>
      require<ReactComponentModule>('@screens/DrinkingSession/EditSessionScreen')
        .default,
    [SCREENS.DRINKING_SESSION.SESSION_DATE_SCREEN]: () =>
      require<ReactComponentModule>('@screens/DrinkingSession/SessionDateScreen')
        .default,
    [SCREENS.DRINKING_SESSION.SESSION_NOTE_SCREEN]: () =>
      require<ReactComponentModule>('@screens/DrinkingSession/SessionNoteScreen')
        .default,
    [SCREENS.DRINKING_SESSION.SESSION_TIMEZONE_SCREEN]: () =>
      require<ReactComponentModule>('@screens/DrinkingSession/SessionTimezoneScreen')
        .default,
    [SCREENS.DRINKING_SESSION.SUMMARY]: () =>
      require<ReactComponentModule>('@screens/DrinkingSession/SessionSummaryScreen')
        .default,
  });

const SettingsModalStackNavigator =
  createModalStackNavigator<SettingsNavigatorParamList>({
    [SCREENS.SETTINGS.ROOT]: () =>
      require<ReactComponentModule>('@screens/Settings/SettingsScreen').default,
    [SCREENS.SETTINGS.ACCOUNT.ROOT]: () =>
      require<ReactComponentModule>('@screens/Settings/Account/AccountScreen')
        .default,
    [SCREENS.SETTINGS.ACCOUNT.USER_NAME]: () =>
      require<ReactComponentModule>('@screens/Settings/Account/UserNameScreen')
        .default,
    [SCREENS.SETTINGS.ACCOUNT.DISPLAY_NAME]: () =>
      require<ReactComponentModule>('@screens/Settings/Account/DisplayNameScreen')
        .default,
    [SCREENS.SETTINGS.ACCOUNT.EMAIL]: () =>
      require<ReactComponentModule>('@screens/Settings/Account/EmailScreen')
        .default,
    [SCREENS.SETTINGS.ACCOUNT.PASSWORD]: () =>
      require<ReactComponentModule>('@screens/Settings/Account/PasswordScreen')
        .default,
    [SCREENS.SETTINGS.ACCOUNT.TIMEZONE]: () =>
      require<ReactComponentModule>('@screens/Settings/Account/TimezoneInitialScreen')
        .default,
    [SCREENS.SETTINGS.ACCOUNT.TIMEZONE_SELECT]: () =>
      require<ReactComponentModule>('@screens/Settings/Account/TimezoneSelectScreen')
        .default,
    [SCREENS.SETTINGS.PREFERENCES.ROOT]: () =>
      require<ReactComponentModule>('@screens/Settings/Preferences/PreferencesScreen')
        .default,
    [SCREENS.SETTINGS.PREFERENCES.LANGUAGE]: () =>
      require<ReactComponentModule>('@screens/Settings/Preferences/LanguageScreen')
        .default,
    [SCREENS.SETTINGS.PREFERENCES.THEME]: () =>
      require<ReactComponentModule>('@screens/Settings/Preferences/ThemeScreen')
        .default,
    [SCREENS.SETTINGS.PREFERENCES.FIRST_DAY_OF_WEEK]: () =>
      require<ReactComponentModule>('@screens/Settings/Preferences/FirstDayOfWeekScreen')
        .default,
    [SCREENS.SETTINGS.PREFERENCES.UNITS_TO_COLORS]: () =>
      require<ReactComponentModule>('@screens/Settings/Preferences/UnitsToColorsScreen')
        .default,
    [SCREENS.SETTINGS.PREFERENCES.DRINKS_TO_UNITS]: () =>
      require<ReactComponentModule>('@screens/Settings/Preferences/DrinksToUnitsScreen')
        .default,
    [SCREENS.SETTINGS.ADMIN.ROOT]: () =>
      require<ReactComponentModule>('@screens/Settings/Admin/AdminScreen')
        .default,
    [SCREENS.SETTINGS.ADMIN.FEEDBACK]: () =>
      require<ReactComponentModule>('@screens/Settings/Admin/SeeFeedbackScreen')
        .default,
    [SCREENS.SETTINGS.ADMIN.BUGS]: () =>
      require<ReactComponentModule>('@screens/Settings/Admin/SeeBugsScreen')
        .default,
    [SCREENS.SETTINGS.APP_SHARE]: () =>
      require<ReactComponentModule>('@screens/Settings/AppShareScreen').default,
    [SCREENS.SETTINGS.TERMS_OF_SERVICE]: () =>
      require<ReactComponentModule>('@screens/Settings/TermsOfServiceScreen')
        .default,
    [SCREENS.SETTINGS.PRIVACY_POLICY]: () =>
      require<ReactComponentModule>('@screens/Settings/PrivacyPolicyScreen')
        .default,
    [SCREENS.SETTINGS.SUBSCRIPTION_TERMS]: () =>
      require<ReactComponentModule>('@screens/Settings/SubscriptionTermsScreen')
        .default,
    [SCREENS.SETTINGS.REPORT_BUG]: () =>
      require<ReactComponentModule>('@screens/Settings/ReportBugScreen')
        .default,
    [SCREENS.SETTINGS.FEEDBACK]: () =>
      require<ReactComponentModule>('@screens/Settings/FeedbackScreen').default,
    [SCREENS.SETTINGS.ABOUT]: () =>
      require<ReactComponentModule>('@screens/Settings/AboutScreen').default,
    [SCREENS.SETTINGS.DELETE]: () =>
      require<ReactComponentModule>('@screens/Settings/DeleteAccountScreen')
        .default,
  });

const ProfileModalStackNavigator =
  createModalStackNavigator<ProfileNavigatorParamList>({
    [SCREENS.PROFILE.ROOT]: () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      require('@screens/Profile/ProfileScreen').default as React.ComponentType,
    [SCREENS.PROFILE.FRIENDS_FRIENDS]: () =>
      require<ReactComponentModule>('@screens/Profile/FriendsFriendsScreen')
        .default,
  });

const SocialModalStackNavigator =
  createModalStackNavigator<SocialNavigatorParamList>({
    [SCREENS.SOCIAL.ROOT]: () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      require('@screens/Social/SocialScreen').default as React.ComponentType,
    [SCREENS.SOCIAL.FRIEND_LIST]: () =>
      require<ReactComponentModule>('@screens/Social/FriendListScreen').default,
    [SCREENS.SOCIAL.FRIEND_REQUESTS]: () =>
      require<ReactComponentModule>('@screens/Social/FriendRequestScreen')
        .default,
    [SCREENS.SOCIAL.FRIEND_SEARCH]: () =>
      require<ReactComponentModule>('@screens/Social/FriendSearchScreen')
        .default,
  });

const StatisticsModalStackNavigator =
  createModalStackNavigator<StatisticsNavigatorParamList>({
    [SCREENS.STATISTICS.ROOT]: () =>
      require<ReactComponentModule>('@screens/Statistics/StatisticsScreen')
        .default,
  });

export {
  AchievementsModalStackNavigator,
  DayOverviewModalStackNavigator,
  DrinkingSessionModalStackNavigator,
  ProfileModalStackNavigator,
  SettingsModalStackNavigator,
  SocialModalStackNavigator,
  StatisticsModalStackNavigator,
};
