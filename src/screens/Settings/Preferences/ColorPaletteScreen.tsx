import React, {useState} from 'react';
import {Alert, View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import Switch from '@components/Switch';
import Text from '@components/Text';
import {PressableWithFeedback} from '@components/Pressable';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import * as Preferences from '@userActions/Preferences';
import type {SessionColorPalette} from '@src/types/onyx';
import type {PaletteId} from '@libs/SessionColorPalettes';
import {
  PALETTE_IDS,
  PALETTES,
  DEFAULT_PALETTE_ID,
  getPaletteIdFromColors,
} from '@libs/SessionColorPalettes';
import useTheme from '@hooks/useTheme';

const PREVIEW_KEYS: ReadonlyArray<keyof SessionColorPalette> = [
  'green',
  'yellow',
  'orange',
  'red',
  'black',
];

type WeekCell = {
  day: number;
  slot: keyof SessionColorPalette;
  units: number;
};

// A representative week — 3 rest days + 4 active days covering each severity
// once. Keeps the preview honest about what a normal week looks like rather
// than showing every cell maxed out.
const WEEK_OVERLAY: readonly WeekCell[] = [
  {day: 10, slot: 'green', units: 0},
  {day: 11, slot: 'yellow', units: 3},
  {day: 12, slot: 'green', units: 0},
  {day: 13, slot: 'orange', units: 7},
  {day: 14, slot: 'red', units: 12},
  {day: 15, slot: 'black', units: 20},
  {day: 16, slot: 'green', units: 0},
];

function ColorPaletteScreen() {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const {preferences} = useDatabaseData();
  const [pendingPaletteId, setPendingPaletteId] = useState<PaletteId | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [pendingUseOwnForOthers, setPendingUseOwnForOthers] = useState<
    boolean | null
  >(null);
  const [savingUseOwnForOthers, setSavingUseOwnForOthers] = useState(false);

  // Selection accent uses the app brand color (yellowStrong) so the picker stays
  // visually integrated with the rest of the app.
  const accent = theme.appColor;
  const accentTint = `${accent}1F`;

  const activePaletteId =
    getPaletteIdFromColors(preferences?.session_color_palette) ??
    DEFAULT_PALETTE_ID;
  // Optimistic preview: while a save is in flight, render the just-tapped palette.
  const displayPaletteId = pendingPaletteId ?? activePaletteId;
  const displayPalette = PALETTES[displayPaletteId];

  const onSelectPalette = (id: PaletteId) => {
    if (saving || id === displayPaletteId) {
      return;
    }
    setPendingPaletteId(id);
    setSaving(true);
    Preferences.updatePreferences(db, user, {
      session_color_palette: PALETTES[id],
    })
      .catch(error => {
        setPendingPaletteId(null);
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('preferencesScreen.error.save'), errorMessage);
      })
      .finally(() => setSaving(false));
  };

  const persistedUseOwnForOthers =
    preferences?.use_own_palette_for_others === true;
  const displayUseOwnForOthers =
    pendingUseOwnForOthers ?? persistedUseOwnForOthers;

  const onToggleUseOwnForOthers = (next: boolean) => {
    if (savingUseOwnForOthers || next === displayUseOwnForOthers) {
      return;
    }
    setPendingUseOwnForOthers(next);
    setSavingUseOwnForOthers(true);
    Preferences.updatePreferences(db, user, {
      use_own_palette_for_others: next,
    })
      .catch(error => {
        setPendingUseOwnForOthers(null);
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('preferencesScreen.error.save'), errorMessage);
      })
      .finally(() => setSavingUseOwnForOthers(false));
  };

  return (
    <ScreenWrapper testID={ColorPaletteScreen.displayName}>
      <HeaderWithBackButton
        title={translate('colorPaletteScreen.title')}
        shouldShowBackButton
        onBackButtonPress={() => Navigation.goBack()}
        onCloseButtonPress={() => Navigation.dismissModal()}
      />
      <ScrollView
        style={[styles.flexGrow1, styles.mnw100]}
        stickyHeaderIndices={[1]}>
        <Section
          title={translate('colorPaletteScreen.title')}
          titleStyles={styles.generalSectionTitle}
          subtitle={translate('colorPaletteScreen.description')}
          subtitleMuted
          isCentralPane>
          <View />
        </Section>
        <View style={[styles.ph5, styles.pv2, {backgroundColor: theme.appBG}]}>
          <View
            style={[
              styles.overflowHidden,
              styles.p3,
              styles.flexRow,
              styles.justifyContentBetween,
              {borderRadius: 12, borderWidth: 1, borderColor: accentTint},
            ]}>
            {WEEK_OVERLAY.map(cell => {
              const marking = {color: displayPalette[cell.slot]};
              const unitsText = cell.units > 0 ? String(cell.units) : '';
              return (
                <View
                  key={cell.day}
                  style={StyleUtils.getSessionsCalendarDayCellStyle(
                    marking,
                    false,
                    false,
                  )}>
                  <Text
                    style={StyleUtils.getSessionsCalendarDayLabelStyle(
                      marking,
                      false,
                    )}>
                    {cell.day}
                  </Text>
                  {unitsText !== '' && (
                    <Text
                      style={StyleUtils.getSessionsCalendarDayUnitsTextStyle(
                        marking,
                      )}>
                      {unitsText}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
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
                {translate('colorPaletteScreen.useOwnPaletteForOthers.label')}
              </Text>
              <Text style={[styles.textMicroSupporting, styles.mt1]}>
                {translate(
                  'colorPaletteScreen.useOwnPaletteForOthers.description',
                )}
              </Text>
            </View>
            <Switch
              accessibilityLabel={translate(
                'colorPaletteScreen.useOwnPaletteForOthers.label',
              )}
              isOn={displayUseOwnForOthers}
              onToggle={onToggleUseOwnForOthers}
            />
          </View>
          <View>
            {PALETTE_IDS.map(id => {
              const palette = PALETTES[id];
              const isActive = id === displayPaletteId;
              const paletteName = translate(
                `colorPaletteScreen.palettes.${id}` as const,
              );
              const paletteDescription = translate(
                `colorPaletteScreen.descriptions.${id}` as const,
              );
              return (
                <PressableWithFeedback
                  key={id}
                  accessibilityLabel={paletteName}
                  accessibilityState={{selected: isActive}}
                  onPress={() => onSelectPalette(id)}
                  style={[
                    styles.flexRow,
                    styles.alignItemsCenter,
                    styles.justifyContentBetween,
                    styles.p4,
                    styles.mb2,
                    {
                      borderRadius: 12,
                      borderLeftWidth: 4,
                      borderLeftColor: isActive ? accent : 'transparent',
                      backgroundColor: isActive ? accentTint : 'transparent',
                    },
                  ]}>
                  <View style={[styles.flexColumn, styles.flex1]}>
                    <Text style={[styles.textNormal, styles.textStrong]}>
                      {paletteName}
                    </Text>
                    <Text style={[styles.textMicroSupporting, styles.mt1]}>
                      {paletteDescription}
                    </Text>
                    <View style={[styles.flexRow, styles.mt2]}>
                      {PREVIEW_KEYS.map(key => (
                        <View
                          key={key}
                          style={{
                            width: 40,
                            height: 22,
                            borderRadius: 6,
                            marginRight: 8,
                            backgroundColor: palette[key],
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  {isActive && (
                    <Icon
                      src={KirokuIcons.Checkmark}
                      fill={accent}
                      width={20}
                      height={20}
                    />
                  )}
                </PressableWithFeedback>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

ColorPaletteScreen.displayName = 'ColorPaletteScreen';
export default ColorPaletteScreen;
