import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Alert, View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import {getDefaultPreferences} from '@userActions/User';
import type {UnitsToColors} from '@src/types/onyx';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import {isEqual} from 'lodash';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useDiscardChangesGuard from '@hooks/useDiscardChangesGuard';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import Button from '@components/Button';
import useThemeStyles from '@hooks/useThemeStyles';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import MenuItem from '@components/MenuItem';
import * as Preferences from '@userActions/Preferences';
import type {NumericSliderProps} from '@components/Popups/NumericSlider';
import NumericSlider from '@components/Popups/NumericSlider';
import type {CalendarColors} from '@components/SessionsCalendar/types';

type MenuItemProps = {
  title?: string;
  key: CalendarColors;
  currentValue: number;
};

type PreferencesSliderConfig = NumericSliderProps & {
  list: string;
  key: string;
};

function UnitsToColorsScreen() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const {preferences} = useDatabaseData();
  const initialValues = useRef(preferences?.units_to_colors);
  const [saving, setSaving] = useState<boolean>(false);
  const [currentValues, setCurrentValues] = useState<UnitsToColors>(
    preferences?.units_to_colors ?? getDefaultPreferences().units_to_colors,
  );

  const [sliderConfig, setSliderConfig] = useState<PreferencesSliderConfig>({
    visible: false,
    heading: '',
    value: 0,
    maxValue: 15,
    step: 1,
    onRequestClose: () => {},
    onSave: () => {},
    list: 'units_to_colors',
    key: '',
  });

  const haveValuesChanged = useCallback(
    () => !isEqual(initialValues.current, currentValues),
    [currentValues],
  );

  const discardChangesModal = useDiscardChangesGuard(haveValuesChanged);

  const handleSaveValues = () => {
    (async () => {
      try {
        setSaving(true);
        await Preferences.updatePreferences(db, user, {
          units_to_colors: currentValues,
        });
        initialValues.current = currentValues;
        Navigation.goBack();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('preferencesScreen.error.save'), errorMessage);
      } finally {
        setSaving(false);
      }
    })();
  };

  const unitsToColorsMenuItems = useMemo(() => {
    const unitsHelperData: MenuItemProps[] = [
      {
        title: translate('units.yellow'),
        key: 'yellow',
        currentValue: currentValues.yellow,
      },
      {
        title: translate('units.orange'),
        key: 'orange',
        currentValue: currentValues.orange,
      },
    ];

    return unitsHelperData.map((detail, index) => {
      const openSlider = () => {
        setSliderConfig(prev => ({
          ...prev,
          visible: true,
          heading: detail.title ?? '',
          value: detail.currentValue ?? 0,
          key: detail.key ?? '',
          onSave: (value: number) => {
            setCurrentValues(prevVal => ({
              ...prevVal,
              [detail.key]: value,
            }));
          },
        }));
      };

      return (
        <MenuItem
          // eslint-disable-next-line react/no-array-index-key
          key={`${detail.title}_${index}`}
          title={detail.title}
          titleStyle={styles.plainSectionTitle}
          wrapperStyle={styles.sectionMenuItemTopDescription}
          shouldUseRowFlexDirection
          shouldShowRightIcon={false}
          shouldShowRightComponent
          onPress={openSlider}
          rightComponent={
            <Button
              text={detail.currentValue.toString()}
              style={styles.settingValueButton}
              onPress={openSlider}
            />
          }
        />
      );
    });
  }, [
    currentValues.orange,
    currentValues.yellow,
    styles.plainSectionTitle,
    styles.sectionMenuItemTopDescription,
    styles.settingValueButton,
    translate,
  ]);

  if (saving) {
    return (
      <FullScreenLoadingIndicator
        loadingText={translate('preferencesScreen.saving')}
      />
    );
  }

  return (
    <ScreenWrapper testID={UnitsToColorsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('unitsToColorsScreen.title')}
        shouldShowBackButton
        onBackButtonPress={() => Navigation.goBack()}
        onCloseButtonPress={() => Navigation.dismissModal()}
      />
      <ScrollView style={[styles.flexGrow1, styles.mnw100]}>
        <Section
          title={translate('unitsToColorsScreen.title')}
          titleStyles={styles.generalSectionTitle}
          subtitle={translate('unitsToColorsScreen.description')}
          subtitleMuted
          isCentralPane
          childrenStyles={styles.pt3}>
          {unitsToColorsMenuItems}
        </Section>
      </ScrollView>
      <View style={[styles.bottomTabBarContainer, styles.p5]}>
        <Button
          large
          success
          text={translate('common.save')}
          onPress={handleSaveValues}
          style={styles.bottomTabButton}
        />
      </View>
      <NumericSlider
        visible={sliderConfig.visible}
        value={sliderConfig.value}
        heading={sliderConfig.heading}
        step={sliderConfig.step}
        maxValue={sliderConfig.maxValue}
        onRequestClose={() => {
          setSliderConfig(prev => ({...prev, visible: false}));
        }}
        onSave={newValue => {
          setCurrentValues(prev => ({
            ...prev,
            [sliderConfig.key]: newValue,
          }));
          setSliderConfig(prev => ({...prev, visible: false}));
        }}
      />
      {discardChangesModal}
    </ScreenWrapper>
  );
}

UnitsToColorsScreen.displayName = 'UnitsToColorsScreen';
export default UnitsToColorsScreen;
