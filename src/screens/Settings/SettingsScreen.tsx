import {useRoute} from '@react-navigation/native';
import React, {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  // eslint-disable-next-line no-restricted-imports
  ScrollView as RNScrollView,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {View} from 'react-native';
import ConfirmModal from '@components/ConfirmModal';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import * as Session from '@userActions/Session';
import MenuItem from '@components/MenuItem';
import ScreenWrapper from '@components/ScreenWrapper';
import {ScrollOffsetContext} from '@components/ScrollOffsetContextProvider';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useActiveCentralPaneRoute from '@hooks/useActiveCentralPaneRoute';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useSingleExecution from '@hooks/useSingleExecution';
import useThemeStyles from '@hooks/useThemeStyles';
import useWaitForNavigation from '@hooks/useWaitForNavigation';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import type IconAsset from '@src/types/utils/IconAsset';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import {useFirebase} from '@context/global/FirebaseContext';
import UserOffline from '@components/UserOfflineModal';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import {useDatabaseData} from '@context/global/DatabaseDataContext';

type MenuData = {
  translationKey: TranslationPaths;
  icon: IconAsset;
  routeName?: Route;
  action?: () => void;
  link?: string | (() => Promise<string>);
  iconStyles?: StyleProp<ViewStyle>;
  fallbackIcon?: IconAsset;
  shouldStackHorizontally?: boolean;
  title?: string;
  shouldShowRightIcon?: boolean;
  iconRight?: IconAsset;
};

type Menu = {
  sectionStyle: StyleProp<ViewStyle>;
  sectionTranslationKey: TranslationPaths;
  items: MenuData[];
};

function SettingsScreen() {
  const network = useNetwork();
  const {auth} = useFirebase();
  const styles = useThemeStyles();
  const {userData} = useDatabaseData();
  const {isExecuting, singleExecution} = useSingleExecution();
  const waitForNavigate = useWaitForNavigation();
  const popoverAnchor = useRef(null);
  const {translate} = useLocalize();
  const activeCentralPaneRoute = useActiveCentralPaneRoute();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const userIsAdmin = userData && userData.role === 'admin';

  const [shouldShowSignoutConfirmModal, setShouldShowSignoutConfirmModal] =
    useState(false);

  const toggleSignoutConfirmModal = (value: boolean) => {
    setShouldShowSignoutConfirmModal(value);
  };

  const onSignOut = useCallback(() => {
    (async () => {
      if (!shouldShowSignoutConfirmModal) {
        toggleSignoutConfirmModal(true);
        return;
      }

      setLoadingText(translate('settingsScreen.signingOut'));
      setIsLoading(true);
      toggleSignoutConfirmModal(false);
      await Session.signOut(auth);
      setIsLoading(false);
    })();
  }, [auth, shouldShowSignoutConfirmModal, translate]);

  /**
   * Retuns a list of menu items data for account section
   * @returns object with translationKey, style and items for the account section
   */
  const accountMenuItemsData: Menu = useMemo(() => {
    // const profileBrickRoadIndicator =
    // UserUtils.getLoginListBrickRoadIndicator(loginList);
    const defaultMenu: Menu = {
      sectionStyle: styles.accountSettingsSectionContainer,
      sectionTranslationKey: 'common.account',
      items: [
        {
          translationKey: 'common.profile',
          icon: KirokuIcons.Profile,
          routeName: ROUTES.SETTINGS_ACCOUNT,
        },
        {
          translationKey: 'common.preferences',
          icon: KirokuIcons.Gear,
          routeName: ROUTES.SETTINGS_PREFERENCES,
        },
        {
          translationKey: 'supporter.menuEntry',
          icon: KirokuIcons.Star,
          routeName: ROUTES.SETTINGS_SUPPORT,
        },
      ],
    };

    return defaultMenu;
  }, [styles.accountSettingsSectionContainer]);

  /**
   * Retuns a list of menu items data for general section
   * @returns object with translationKey, style and items for the general section
   */
  const generalMenuItemsData: Menu = useMemo(() => {
    return {
      sectionStyle: styles.generalSettingsSectionContainer,
      sectionTranslationKey: 'settingsScreen.general',
      items: [
        {
          translationKey: 'settingsScreen.reportBug',
          icon: KirokuIcons.Bug,
          routeName: ROUTES.SETTINGS_REPORT_BUG,
        },
        {
          translationKey: 'settingsScreen.giveFeedback',
          icon: KirokuIcons.Idea,
          routeName: ROUTES.SETTINGS_FEEDBACK,
        },
        {
          translationKey: 'settingsScreen.shareTheApp',
          icon: KirokuIcons.Share,
          routeName: ROUTES.SETTINGS_APP_SHARE,
        },
        {
          translationKey: 'settingsScreen.about',
          icon: KirokuIcons.Info,
          routeName: ROUTES.SETTINGS_ABOUT,
        },
      ],
    };
  }, [styles.generalSettingsSectionContainer]);

  /**
   * Retuns a list of menu items data for authentication section
   * @returns object with translationKey, style and items for the authentication section
   */
  const authenticationMenuItemsData: Menu = useMemo(() => {
    return {
      sectionStyle: {
        ...styles.pt4,
      },
      sectionTranslationKey: 'common.authentication',
      items: [
        {
          translationKey: 'settingsScreen.signOut',
          icon: KirokuIcons.Exit,
          action: onSignOut,
        },
        {
          translationKey: 'settingsScreen.deleteAccount',
          icon: KirokuIcons.Delete,
          routeName: ROUTES.SETTINGS_DELETE,
        },
        ...(userIsAdmin
          ? [
              {
                translationKey: 'settingsScreen.adminTools',
                icon: KirokuIcons.Logo,
                routeName: ROUTES.SETTINGS_ADMIN,
              } as MenuData,
            ]
          : []),
      ],
    };
  }, [styles.pt4, onSignOut, userIsAdmin]);

  /**
   * Retuns JSX.Element with menu items
   * @param menuItemsData list with menu items data
   * @returns the menu items for passed data
   */
  const getMenuItemsSection = useCallback(
    (menuItemsData: Menu) => {
      return (
        <View style={[menuItemsData.sectionStyle, styles.pb4, styles.mh3]}>
          <Text style={styles.sectionTitle}>
            {translate(menuItemsData.sectionTranslationKey)}
          </Text>
          {menuItemsData.items.map(item => {
            const keyTitle = item.translationKey
              ? translate(item.translationKey)
              : item.title;

            return (
              <MenuItem
                key={keyTitle}
                wrapperStyle={styles.sectionMenuItem}
                title={keyTitle}
                icon={item.icon}
                iconType={CONST.ICON_TYPE_ICON}
                disabled={isExecuting}
                onPress={singleExecution(() => {
                  if (item.action) {
                    item.action();
                  } else {
                    waitForNavigate(() => {
                      Navigation.navigate(item.routeName);
                    })();
                  }
                })}
                iconStyles={item.iconStyles}
                fallbackIcon={item.fallbackIcon}
                shouldStackHorizontally={item.shouldStackHorizontally}
                ref={popoverAnchor}
                hoverAndPressStyle={styles.hoveredComponentBG}
                shouldBlockSelection={!!item.link}
                focused={
                  !!activeCentralPaneRoute &&
                  !!item.routeName &&
                  !!(
                    activeCentralPaneRoute.name
                      .toLowerCase()
                      .replaceAll('_', '') ===
                    item.routeName.toLowerCase().replaceAll('/', '')
                  )
                }
                isPaneMenu
                iconRight={item.iconRight}
                shouldShowRightIcon={item.shouldShowRightIcon}
              />
            );
          })}
        </View>
      );
    },
    [
      styles.pb4,
      styles.mh3,
      styles.sectionTitle,
      styles.sectionMenuItem,
      styles.hoveredComponentBG,
      translate,
      isExecuting,
      singleExecution,
      activeCentralPaneRoute,
      waitForNavigate,
    ],
  );

  const accountMenuItems = useMemo(
    () => getMenuItemsSection(accountMenuItemsData),
    [accountMenuItemsData, getMenuItemsSection],
  );
  const generalMenuItems = useMemo(
    () => getMenuItemsSection(generalMenuItemsData),
    [generalMenuItemsData, getMenuItemsSection],
  );
  const authenticationMenuItems = useMemo(
    () => getMenuItemsSection(authenticationMenuItemsData),
    [authenticationMenuItemsData, getMenuItemsSection],
  );

  const {saveScrollOffset, getScrollOffset} = useContext(ScrollOffsetContext);
  const route = useRoute();
  const scrollViewRef = useRef<RNScrollView>(null);

  const onScroll = useCallback<NonNullable<ScrollViewProps['onScroll']>>(
    e => {
      // If the layout measurement is 0, it means the flashlist is not displayed but the onScroll may be triggered with offset value 0.
      // We should ignore this case.
      if (e.nativeEvent.layoutMeasurement.height === 0) {
        return;
      }
      saveScrollOffset(route, e.nativeEvent.contentOffset.y);
    },
    [route, saveScrollOffset],
  );

  useLayoutEffect(() => {
    const scrollOffset = getScrollOffset(route);
    if (!scrollOffset || !scrollViewRef.current) {
      return;
    }
    scrollViewRef.current.scrollTo({y: scrollOffset, animated: false});
  }, [getScrollOffset, route]);

  if (network.isOffline) {
    return <UserOffline />;
  }
  if (isLoading) {
    return <FullScreenLoadingIndicator loadingText={loadingText} />;
  }

  return (
    <ScreenWrapper
      style={[styles.w100, styles.pb0]}
      includePaddingTop
      includeSafeAreaPaddingBottom={false}
      testID={SettingsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('settingsScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <ScrollView
        ref={scrollViewRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.w100]}>
        {accountMenuItems}
        {generalMenuItems}
        {authenticationMenuItems}
        <ConfirmModal
          danger
          title={translate('common.areYouSure')}
          prompt={translate('settingsScreen.signOutConfirmationText')}
          confirmText={translate('settingsScreen.signOut')}
          cancelText={translate('common.cancel')}
          isVisible={shouldShowSignoutConfirmModal}
          onConfirm={onSignOut}
          onCancel={() => toggleSignoutConfirmModal(false)}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

SettingsScreen.displayName = 'SettingsScreen';
export default SettingsScreen;
