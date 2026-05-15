import React, {useCallback, useMemo, useRef} from 'react';
import {Linking, View} from 'react-native';
// eslint-disable-next-line no-restricted-imports
import type {Text as RNText, StyleProp, ViewStyle} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import MenuItemList from '@components/MenuItemList';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import * as Environment from '@libs/Environment/Environment';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ROUTES from '@src/ROUTES';
import type IconAsset from '@src/types/utils/IconAsset';
import {version as _version} from '../../../package.json';

function getFlavor(): string {
  const bundleId = DeviceInfo.getBundleId();
  if (bundleId.includes('dev')) {
    return ' Develop';
  }
  if (bundleId.includes('adhoc')) {
    return ' Ad-Hoc';
  }
  return '';
}

type MenuItem = {
  translationKey: TranslationPaths;
  icon: IconAsset;
  iconRight?: IconAsset;
  action?: () => Promise<void>;
  onPress?: () => void;
  link?: string;
  wrapperStyle?: StyleProp<ViewStyle>;
};

function AboutScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const popoverAnchor = useRef<View | RNText | null>(null);
  const {shouldUseNarrowLayout} = useResponsiveLayout();

  const menuItems = useMemo(() => {
    const baseMenuItems: MenuItem[] = [
      //   {
      //     translationKey: 'initialSettingsPage.aboutPage.appDownloadLinks',
      //     icon: KirokuIcons.Link,
      //     action: waitForNavigate(() =>
      //       Navigation.navigate(ROUTES.SETTINGS_APP_DOWNLOAD_LINKS),
      //     ),
      //   },
      {
        translationKey: 'settingsScreen.aboutScreen.viewTheCode',
        icon: KirokuIcons.Eye,
        iconRight: KirokuIcons.NewWindow,
        action: () => {
          Linking.openURL(CONST.GITHUB_URL);
          // Link.openExternalLink(CONST.GITHUB_URL); // TODO
          return Promise.resolve();
        },
        link: CONST.GITHUB_URL,
      },
      {
        translationKey: 'settingsScreen.aboutScreen.joinDiscord',
        icon: KirokuIcons.Discord,
        iconRight: KirokuIcons.NewWindow,
        action: () => {
          Linking.openURL(CONST.DISCORD_INVITE_URL);
          // Link.openExternalLink(CONST.DISCORD_INVITE_URL); // TODO
          return Promise.resolve();
        },
        link: CONST.DISCORD_INVITE_URL,
      },
      {
        translationKey: 'common.termsOfService',
        icon: KirokuIcons.FileDocument,
        onPress: () => Navigation.navigate(ROUTES.SETTINGS_TERMS_OF_SERVICE),
      },
      {
        translationKey: 'common.privacyPolicy',
        icon: KirokuIcons.FileDocument,
        onPress: () => Navigation.navigate(ROUTES.SETTINGS_PRIVACY_POLICY),
      },
      {
        translationKey: 'common.subscriptionTerms',
        icon: KirokuIcons.FileDocument,
        onPress: () => Navigation.navigate(ROUTES.SETTINGS_SUBSCRIPTION_TERMS),
      },
    ];

    return baseMenuItems.map(
      ({translationKey, icon, iconRight, action, link, onPress}: MenuItem) => ({
        translationKey, // represents the key object here
        title: translate(translationKey),
        icon,
        iconRight,
        onPress: action ?? onPress,
        shouldShowRightIcon: true,
        ref: popoverAnchor,
        shouldBlockSelection: !!link,
        wrapperStyle: [styles.sectionMenuItemTopDescription],
      }),
    );
  }, [styles, translate]);

  const versionInfoContainer = useCallback(
    () => (
      <View style={[styles.justifyContentEnd, styles.pr5, styles.pb3]}>
        <Text
          selectable
          style={[styles.textNormal, styles.textVersion, styles.alignSelfEnd]}>
          {translate('settingsScreen.aboutScreen.versionLetter')}
          {Environment.isInternalTestBuild()
            ? `${_version} PR:${CONST.PULL_REQUEST_NUMBER}${getFlavor()}`
            : `${_version}${getFlavor()}`}
        </Text>
      </View>
    ),
    // disabling this rule, as we want this to run only on the first render
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    [],
  );

  return (
    <ScreenWrapper
      shouldEnablePickerAvoiding={false}
      shouldShowOfflineIndicatorInWideScreen
      testID={AboutScreen.displayName}>
      <HeaderWithBackButton
        title={translate('settingsScreen.about')}
        shouldShowBackButton={shouldUseNarrowLayout}
        onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS)}
      />
      <ScrollView contentContainerStyle={styles.pt3}>
        <View style={[styles.flex1]}>
          <Section
            title={translate('settingsScreen.aboutScreen.aboutKiroku')}
            subtitle={translate('settingsScreen.aboutScreen.description')}
            isCentralPane
            subtitleMuted
            titleStyles={styles.accountSettingsSectionTitle}>
            <View style={[styles.flex1, styles.mt5]}>
              <MenuItemList menuItems={menuItems} shouldUseSingleExecution />
            </View>
          </Section>
        </View>
      </ScrollView>
      {versionInfoContainer()}
    </ScreenWrapper>
  );
}

AboutScreen.displayName = 'AboutScreen';

export default AboutScreen;
