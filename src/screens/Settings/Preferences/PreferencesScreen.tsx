import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, BackHandler, View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
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
import Switch from '@components/Switch';
import Text from '@components/Text';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import CONST from '@src/CONST';
import * as Preferences from '@userActions/Preferences';
import * as SessionLocations from '@userActions/SessionLocations';
import checkPermission from '@libs/Permissions/checkPermission';
import requestPermission from '@libs/Permissions/requestPermission';
import type {PaletteId} from '@libs/SessionColorPalettes';
import {
  DEFAULT_PALETTE_ID,
  getPaletteIdFromColors,
} from '@libs/SessionColorPalettes';

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
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const waitForNavigate = useWaitForNavigation();

  const persistedTrackLocation =
    preferences?.track_location_during_sessions === true;
  const [pendingTrackLocation, setPendingTrackLocation] = useState<
    boolean | null
  >(null);
  const [savingTrackLocation, setSavingTrackLocation] = useState(false);
  const displayTrackLocation = pendingTrackLocation ?? persistedTrackLocation;

  const [showPurgeConfirmModal, setShowPurgeConfirmModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const onConfirmPurge = () => {
    if (isPurging) {
      return;
    }
    setIsPurging(true);
    SessionLocations.purgeAll(db, user)
      .then(() => {
        setShowPurgeConfirmModal(false);
        Alert.alert(
          translate(
            'preferencesScreen.privacySection.clearLocationHistory.success',
          ),
        );
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(
          translate(
            'preferencesScreen.privacySection.clearLocationHistory.error',
          ),
          errorMessage,
        );
      })
      .finally(() => setIsPurging(false));
  };

  const onToggleTrackLocation = (next: boolean) => {
    if (savingTrackLocation || next === displayTrackLocation) {
      return;
    }
    setPendingTrackLocation(next);
    setSavingTrackLocation(true);
    // requestPermission alerts the user itself on denial; rolling back the
    // toggle is enough — never persist "enabled" without the OS grant.
    const permissionCheck: Promise<boolean> = next
      ? checkPermission('location').then(allowed =>
          allowed ? Promise.resolve(true) : requestPermission('location'),
        )
      : Promise.resolve(true);
    permissionCheck
      .then(isGranted => {
        if (!isGranted) {
          setPendingTrackLocation(null);
          return undefined;
        }
        return Preferences.updatePreferences(db, user, {
          track_location_during_sessions: next,
        });
      })
      .catch(error => {
        setPendingTrackLocation(null);
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('preferencesScreen.error.save'), errorMessage);
      })
      .finally(() => setSavingTrackLocation(false));
  };

  // const handleFirstDayOfWeekToggle = (value: boolean) => {
  //   const newValue = value ? 'Monday' : 'Sunday';
  //   setCurrentPreferences(prev => ({...prev, first_day_of_week: newValue}));
  // };

  const generalMenuItemsData: Menu = useMemo(
    () => ({
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
    }),
    [translate, preferences?.theme, preferredLocale],
  ); // Check whether preferred locale does not cause infinite re-render

  const activePaletteId: PaletteId =
    getPaletteIdFromColors(preferences?.session_color_palette) ??
    DEFAULT_PALETTE_ID;

  const drinksAndUnitsMenuItemsData: Menu = useMemo(
    () => ({
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
        {
          title: translate(
            'preferencesScreen.drinksAndUnitsSection.colorPalette',
          ),
          description: translate(
            `colorPaletteScreen.palettes.${activePaletteId}` as const,
          ),
          pageRoute: ROUTES.SETTINGS_COLOR_PALETTE,
        },
      ],
    }),
    [translate, activePaletteId],
  );

  /**
   * Retuns JSX.Element with menu items
   * @param menuItemsData list with menu items data
   * @returns the menu items for passed data
   */
  const getMenuItemsSection = useCallback(
    (menuItemsData: Menu) => (
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
    ),
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

  const privacySection = (
    <Section
      title={translate('preferencesScreen.privacySection.title')}
      titleStyles={styles.generalSectionTitle}
      subtitle={translate('preferencesScreen.privacySection.description')}
      subtitleMuted
      isCentralPane
      childrenStyles={styles.pt3}>
      <View style={[styles.ph5, styles.pt3]}>
        <View
          style={[
            styles.flexRow,
            styles.alignItemsCenter,
            styles.justifyContentBetween,
            styles.mb4,
          ]}>
          <View style={[styles.flexColumn, styles.flex1, styles.mr3]}>
            <Text style={[styles.textNormal, styles.textStrong]}>
              {translate(
                'preferencesScreen.privacySection.trackLocationDuringSessions.label',
              )}
            </Text>
            <Text style={[styles.textMicroSupporting, styles.mt1]}>
              {translate(
                'preferencesScreen.privacySection.trackLocationDuringSessions.description',
              )}
            </Text>
          </View>
          <Switch
            accessibilityLabel={translate(
              'preferencesScreen.privacySection.trackLocationDuringSessions.label',
            )}
            isOn={displayTrackLocation}
            onToggle={onToggleTrackLocation}
          />
        </View>
        <View
          style={[
            styles.flexRow,
            styles.alignItemsCenter,
            styles.justifyContentBetween,
            styles.mb4,
          ]}>
          <View style={[styles.flexColumn, styles.flex1, styles.mr3]}>
            <Text style={[styles.textNormal, styles.textStrong]}>
              {translate(
                'preferencesScreen.privacySection.clearLocationHistory.label',
              )}
            </Text>
            <Text style={[styles.textMicroSupporting, styles.mt1]}>
              {translate(
                'preferencesScreen.privacySection.clearLocationHistory.description',
              )}
            </Text>
          </View>
          <Button
            small
            danger
            text={translate(
              'preferencesScreen.privacySection.clearLocationHistory.button',
            )}
            isDisabled={isPurging}
            onPress={() => setShowPurgeConfirmModal(true)}
          />
        </View>
      </View>
    </Section>
  );

  // Make the system back press toggle the go back handler
  useEffect(() => {
    const backAction = () => {
      Navigation.goBack();
      return true; // Prevent the event from bubbling up and being handled by the default handler
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

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
          {privacySection}
        </MenuItemGroup>
        <ConfirmModal
          danger
          title={translate(
            'preferencesScreen.privacySection.clearLocationHistory.confirmTitle',
          )}
          prompt={translate(
            'preferencesScreen.privacySection.clearLocationHistory.confirmPrompt',
          )}
          confirmText={translate(
            'preferencesScreen.privacySection.clearLocationHistory.confirmAction',
          )}
          cancelText={translate('common.cancel')}
          isVisible={showPurgeConfirmModal}
          onConfirm={onConfirmPurge}
          onCancel={() => setShowPurgeConfirmModal(false)}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

PreferencesScreen.displayName = 'Preferences Screen';
export default PreferencesScreen;
