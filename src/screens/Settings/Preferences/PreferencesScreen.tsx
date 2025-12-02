import React, {useCallback, useEffect, useMemo} from 'react';
import {BackHandler} from 'react-native';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
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
import LocaleUtils from '@libs/LocaleUtils';
import Section from '@components/Section';
import MenuItem from '@components/MenuItem';
import CONST from '@src/CONST';

type MenuData = {
  title?: string;
  description?: string;
  pageRoute?: Route;
  disabled?: boolean;
  rightComponent?: React.ReactNode;
};

type Menu = {
  sectionTranslationKey: TranslationPaths;
  subtitle?: string;
  items: MenuData[];
};

type PreferencesScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.PREFERENCES.ROOT
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PreferencesScreen({route}: PreferencesScreenProps) {
  const {translate, preferredLocale} = useLocalize();
  const styles = useThemeStyles();
  const {singleExecution} = useSingleExecution();
  const {preferences} = useDatabaseData();
  const waitForNavigate = useWaitForNavigation();

  // const handleFirstDayOfWeekToggle = (value: boolean) => {
  //   const newValue = value ? 'Monday' : 'Sunday';
  //   setCurrentPreferences(prev => ({...prev, first_day_of_week: newValue}));
  // };

  const generalMenuItemsData: Menu = useMemo(() => {
    return {
      sectionTranslationKey: 'preferencesScreen.generalSection.title',
      items: [
        // {
        //   title: translate('preferencesScreen.generalSection.firstDayOfWeek'),
        //   description: 'Monday',
        //   pageRoute: ROUTES.SETTINGS_FIRST_DAY_OF_WEEK,
        // },
        {
          title: translate('languageScreen.language'),
          description: `${translate(`languageScreen.languages.${LocaleUtils.getLanguageFromLocale(preferredLocale)}.label`)}`,
          pageRoute: ROUTES.SETTINGS_LANGUAGE,
        },
        {
          title: translate('themeScreen.theme'),
          description: `${translate(
            `themeScreen.themes.${preferences?.theme ?? CONST.THEME.DEFAULT}.label`,
          )}`,
          pageRoute: ROUTES.SETTINGS_THEME,
        },
      ],
    };
  }, [translate, preferences?.theme, preferredLocale]); // Check whether preferred locale does not cause infinite re-render

  const drinksAndUnitsMenuItemsData: Menu = useMemo(() => {
    return {
      sectionTranslationKey: 'preferencesScreen.drinksAndUnitsSection.title',
      subtitle: translate(
        'preferencesScreen.drinksAndUnitsSection.description',
      ),
      items: [
        {
          title: translate(
            'preferencesScreen.drinksAndUnitsSection.drinksToUnits',
          ),
          pageRoute: ROUTES.SETTINGS_DRINKS_TO_UNITS,
        },
        {
          title: translate(
            'preferencesScreen.drinksAndUnitsSection.unitsToColors',
          ),
          pageRoute: ROUTES.SETTINGS_UNITS_TO_COLORS,
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
                disabled={detail.disabled}
                shouldGreyOutWhenDisabled={false}
                shouldUseRowFlexDirection
                shouldShowRightIcon={!detail.rightComponent}
                shouldShowRightComponent={!!detail.rightComponent}
                rightComponent={detail.rightComponent}
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
  const drinksAndUnitsMenuItems = useMemo(
    () => getMenuItemsSection(drinksAndUnitsMenuItemsData),
    [drinksAndUnitsMenuItemsData, getMenuItemsSection],
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
    <ScreenWrapper testID={PreferencesScreen.displayName}>
      <HeaderWithBackButton
        title={translate('preferencesScreen.title')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.w100]}>
        <MenuItemGroup>
          {generalMenuItems}
          {drinksAndUnitsMenuItems}
        </MenuItemGroup>
      </ScrollView>
    </ScreenWrapper>
  );
}

PreferencesScreen.displayName = 'Preferences Screen';
export default PreferencesScreen;
