import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import MenuItemGroup from '@components/MenuItemGroup';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
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
import {Keyboard, ScrollView} from 'react-native';

type AccountScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.ROOT
>;

function AccountScreen({route}: AccountScreenProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {translate} = useLocalize();
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const {userData, isLoading} = useDatabaseData();
  const profileData = userData?.profile;

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
    // TODO enable these after the email and password screens are ready
    // {
    //   description: translate('common.email'),
    //   title: user?.email ?? '',
    //   pageRoute: ROUTES.SETTINGS_EMAIL,
    // },
    // {
    //   description: translate('common.password'),
    //   title: '••••••••',
    //   pageRoute: ROUTES.SETTINGS_PASSWORD,
    // },
    {
      description: translate('timezoneScreen.timezone'),
      title: userData?.private_data?.timezone?.selected ?? '',
      pageRoute: ROUTES.SETTINGS_TIMEZONE,
    },
  ];

  const personalDetails = [
    {
      description: translate('common.dob'),
      title: (userData?.private_data?.birthdate || '').toString(),
      pageRoute: ROUTES.HOME,
    },
    {
      description: translate('common.gender'),
      title: userData?.private_data?.gender ?? '',
      pageRoute: ROUTES.HOME,
    },
    {
      description: translate('common.weight'),
      title: (userData?.private_data?.weight || '').toString(),
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
            childrenStyles={styles.pt5}
            titleStyles={styles.accountSettingsSectionTitle}>
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
                {generalOptions.map((detail, index) => (
                  <MenuItemWithTopDescription
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${detail.title}_${index}`}
                    shouldShowRightIcon
                    title={detail.title}
                    description={detail.description}
                    wrapperStyle={styles.sectionMenuItemTopDescription}
                    onPress={() => Navigation.navigate(detail.pageRoute)}
                    // brickRoadIndicator={detail.brickRoadIndicator}
                  />
                ))}
              </>
            )}
          </Section>
          {/* Unhide the personal details in a later patch - visually, they are ready */}
          {/* <Section
            title={translate('accountScreen.personalDetails.title')}
            subtitle={translate('accountScreen.personalDetails.subtitle')}
            isCentralPane
            subtitleMuted
            childrenStyles={styles.pt3}
            titleStyles={styles.accountSettingsSectionTitle}>
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
