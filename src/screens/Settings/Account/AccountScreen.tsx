import {Keyboard, View} from 'react-native';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import MenuItemGroup from '@components/MenuItemGroup';
import ScreenWrapper from '@components/ScreenWrapper';
import Section from '@components/Section';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type {StackScreenProps} from '@react-navigation/stack';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import ScrollView from '@components/ScrollView';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';

type AccountScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.ROOT
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AccountScreen({route}: AccountScreenProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {translate} = useLocalize();
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const {userData} = useDatabaseData();
  const profileData = userData?.profile;

  const hasEmailProvider = (user?.providerData ?? []).some(
    p => p.providerId === CONST.AUTH_PROVIDER.PASSWORD,
  );

  // providerData is not a React-tracked value; this snapshot is acceptable for
  // the menu summary because mutations land on the dedicated Connected Accounts
  // screen, which reloads auth.currentUser before rendering its own rows.
  const linkedProviderLabels = (user?.providerData ?? [])
    .map(info => {
      switch (info.providerId) {
        case 'password':
          return translate('connectedAccounts.providers.password');
        case 'apple.com':
          return translate('connectedAccounts.providers.apple');
        case 'google.com':
          return translate('connectedAccounts.providers.google');
        default:
          return null;
      }
    })
    .filter((label): label is string => label !== null)
    .join(', ');

  const generalOptions = [
    {
      description: translate('common.name'),
      title: `${profileData?.first_name ?? ''} ${profileData?.last_name ?? ''}`,
      pageRoute: ROUTES.SETTINGS_USER_NAME,
    },
    {
      description: translate('common.nickname'),
      title: profileData?.display_name ?? '',
      pageRoute: ROUTES.SETTINGS_DISPLAY_NAME,
    },
    ...(hasEmailProvider
      ? [
          {
            description: translate('common.email'),
            title: user?.email ?? '',
            pageRoute: ROUTES.SETTINGS_EMAIL,
          },
          {
            description: translate('common.password'),
            title: '••••••••',
            pageRoute: ROUTES.SETTINGS_PASSWORD,
          },
        ]
      : []),
    {
      description: translate('connectedAccounts.title'),
      title: linkedProviderLabels,
      pageRoute: ROUTES.SETTINGS_CONNECTED_ACCOUNTS,
    },
    {
      description: translate('timezoneScreen.timezone'),
      title: userData?.timezone?.selected ?? '',
      pageRoute: ROUTES.SETTINGS_TIMEZONE,
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const personalDetails = [
    {
      description: translate('common.dob'),
      title: (userData?.private_data?.birthdate ?? '').toString(),
      pageRoute: ROUTES.HOME,
    },
    {
      description: translate('common.gender'),
      title: userData?.private_data?.gender ?? '',
      pageRoute: ROUTES.HOME,
    },
    {
      description: translate('common.weight'),
      title: (userData?.private_data?.weight ?? '').toString(),
      pageRoute: ROUTES.HOME,
    },
  ];

  return (
    <ScreenWrapper
      testID={AccountScreen.displayName}
      includeSafeAreaPaddingBottom={false}
      shouldShowOfflineIndicatorInWideScreen>
      <HeaderWithBackButton
        title={translate('accountScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        style={styles.pt3}>
        <MenuItemGroup>
          <Section
            title={translate('accountScreen.generalOptions.title')}
            isCentralPane
            childrenStyles={styles.pt3}
            titleStyles={styles.generalSectionTitle}>
            {loadingText ? (
              <FullScreenLoadingIndicator
                loadingText={loadingText}
                style={[
                  styles.flex1,
                  styles.pRelative,
                  StyleUtils.getBackgroundColorStyle(theme.cardBG),
                ]}
              />
            ) : (
              <View>
                {generalOptions.map((detail, index) => (
                  <MenuItemWithTopDescription
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${detail.title}_${index}`}
                    shouldShowRightIcon
                    title={detail.title}
                    titleStyle={styles.plainSectionTitle}
                    description={detail.description}
                    wrapperStyle={styles.sectionMenuItemTopDescription}
                    onPress={() => Navigation.navigate(detail.pageRoute)}
                  />
                ))}
              </View>
            )}
          </Section>
          {/* Unhide the personal details in a later patch - visually, they are ready */}
          {/* <Section
            title={translate('accountScreen.personalDetails.title')}
            subtitle={translate('accountScreen.personalDetails.subtitle')}
            isCentralPane
            subtitleMuted
            childrenStyles={styles.pt3}
            titleStyles={styles.generalSectionTitle}>
            {isLoading ? (
              <FullScreenLoadingIndicator
                style={[
                  styles.flex1,
                  styles.pRelative,
                  StyleUtils.getBackgroundColorStyle(theme.cardBG),
                ]}
              />
            ) : (
              <>
                {personalDetails.map((detail, index) => (
                  <MenuItemWithTopDescription
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${detail.title}_${index}`}
                    shouldShowRightIcon
                    title={detail.title}
                    description={detail.description}
                    wrapperStyle={styles.sectionMenuItemTopDescription}
                    onPress={() => Navigation.navigate(detail.pageRoute)}
                  />
                ))}
              </>
            )}
          </Section> */}
        </MenuItemGroup>
      </ScrollView>
    </ScreenWrapper>
  );
}

AccountScreen.displayName = 'Account Screen';
export default AccountScreen;
