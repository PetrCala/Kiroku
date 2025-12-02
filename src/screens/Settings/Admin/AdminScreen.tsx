import React, {useCallback, useEffect, useMemo} from 'react';
import {BackHandler} from 'react-native';
import type {StackScreenProps} from '@react-navigation/stack';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {TranslationPaths} from '@src/languages/types';
import type {Route} from '@src/ROUTES';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useWaitForNavigation from '@hooks/useWaitForNavigation';
import useSingleExecution from '@hooks/useSingleExecution';
import ScrollView from '@components/ScrollView';
import MenuItemGroup from '@components/MenuItemGroup';
import Section from '@components/Section';
import MenuItem from '@components/MenuItem';

type MenuData = {
  title?: string;
  description?: string;
  pageRoute?: Route;
};

type Menu = {
  sectionTranslationKey: TranslationPaths;
  subtitle?: string;
  items: MenuData[];
};

type AdminScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ADMIN.ROOT
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AdminScreen({route}: AdminScreenProps) {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const {singleExecution} = useSingleExecution();
  const waitForNavigate = useWaitForNavigation();

  const generalMenuItemsData: Menu = useMemo(() => {
    return {
      sectionTranslationKey: 'adminScreen.generalSection',
      items: [
        {
          title: translate('adminScreen.seeFeedback'),
          pageRoute: ROUTES.SETTINGS_ADMIN_FEEDBACK,
        },
        {
          title: translate('adminScreen.seeBugReports'),
          pageRoute: ROUTES.SETTINGS_ADMIN_BUGS,
        },
      ],
    };
  }, [translate]);

  /**
   * Retuns JSX.Element with menu items
   * @param menuItemsData list with menu items data
   * @returns the menu items for passed data
   */
  const getMenuItemsSection = useCallback(
    (menuItemsData: Menu) => {
      return (
        <Section
          title={translate(menuItemsData.sectionTranslationKey)}
          titleStyles={styles.generalSectionTitle}
          subtitle={menuItemsData.subtitle}
          subtitleMuted
          isCentralPane
          childrenStyles={styles.pt3}>
          <>
            {menuItemsData.items.map((detail, index) => (
              <MenuItem
                // eslint-disable-next-line react/no-array-index-key
                key={`${detail.title}_${index}`}
                title={detail.title}
                titleStyle={styles.plainSectionTitle}
                description={detail.description}
                wrapperStyle={styles.sectionMenuItemTopDescription}
                shouldUseRowFlexDirection
                shouldShowRightIcon
                onPress={singleExecution(() => {
                  waitForNavigate(() => {
                    Navigation.navigate(detail.pageRoute);
                  })();
                })}
              />
            ))}
          </>
        </Section>
      );
    },
    [
      singleExecution,
      styles.generalSectionTitle,
      styles.plainSectionTitle,
      styles.sectionMenuItemTopDescription,
      styles.pt3,
      waitForNavigate,
      translate,
    ],
  );

  const generalMenuItems = useMemo(
    () => getMenuItemsSection(generalMenuItemsData),
    [generalMenuItemsData, getMenuItemsSection],
  );

  // Make the system back press toggle the go back handler
  useEffect(() => {
    const backAction = () => {
      Navigation.goBack();
      return true; // Prevent the event from bubbling up and being handled by the default handler
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ScreenWrapper testID={AdminScreen.displayName}>
      <HeaderWithBackButton
        title={translate('adminScreen.title')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.w100]}>
        <MenuItemGroup>{generalMenuItems}</MenuItemGroup>
      </ScrollView>
    </ScreenWrapper>
  );
}

AdminScreen.displayName = 'Admin Screen';
export default AdminScreen;
