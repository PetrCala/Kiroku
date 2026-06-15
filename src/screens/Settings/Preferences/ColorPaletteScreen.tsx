import React, {useState} from 'react';
import {Alert, View} from 'react-native';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
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
import ROUTES from '@src/ROUTES';
import PaletteWeekPreview from './PaletteWeekPreview';

const PREVIEW_KEYS: ReadonlyArray<keyof SessionColorPalette> = [
  'green',
  'yellow',
  'orange',
  'red',
  'black',
];

function ColorPaletteScreen() {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  const {translate} = useLocalize();
  const preferences = useCurrentUserPreferences();
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

  const activePalette = preferences?.session_color_palette;
  const matchedPresetId = getPaletteIdFromColors(activePalette);
  // A defined palette that matches no preset means the user's custom slot is the
  // active one (getPaletteIdFromColors returns null in that case).
  const isCustomActive = !!activePalette && matchedPresetId === null;
  const activePresetId = matchedPresetId ?? DEFAULT_PALETTE_ID;
  const customPalette = preferences?.custom_session_color_palette;

  // Which preset row reads as selected: a pending tap wins; otherwise none when
  // the custom slot is active.
  let selectedPresetId: PaletteId | null;
  if (pendingPaletteId) {
    selectedPresetId = pendingPaletteId;
  } else if (isCustomActive) {
    selectedPresetId = null;
  } else {
    selectedPresetId = activePresetId;
  }
  const isCustomSelected = !pendingPaletteId && isCustomActive;

  // Optimistic preview: a just-tapped preset wins; otherwise show the active
  // custom palette when it's selected, falling back to the active preset.
  let displayPalette: SessionColorPalette;
  if (pendingPaletteId) {
    displayPalette = PALETTES[pendingPaletteId];
  } else if (isCustomActive && activePalette) {
    displayPalette = activePalette;
  } else {
    displayPalette = PALETTES[activePresetId];
  }

  const onSelectPalette = (id: PaletteId) => {
    if (saving || id === selectedPresetId) {
      return;
    }
    setPendingPaletteId(id);
    setSaving(true);
    Preferences.updatePreferences({
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
    Preferences.updatePreferences({
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
        <PaletteWeekPreview palette={displayPalette} />
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
              const isActive = id === selectedPresetId;
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
                    StyleUtils.getColorAccentRowStyle(isActive ? accent : null),
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
                          style={[
                            {
                              width: 40,
                              height: 22,
                              borderRadius: 6,
                              marginRight: 8,
                              backgroundColor: palette[key],
                            },
                            StyleUtils.getDerivedSwatchBorderStyle(
                              palette[key],
                            ),
                          ]}
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
            <PressableWithFeedback
              accessibilityLabel={translate('colorPaletteScreen.custom.label')}
              accessibilityState={{selected: isCustomSelected}}
              onPress={() =>
                Navigation.navigate(ROUTES.SETTINGS_COLOR_PALETTE_CUSTOM)
              }
              style={[
                styles.flexRow,
                styles.alignItemsCenter,
                styles.justifyContentBetween,
                styles.p4,
                styles.mb2,
                StyleUtils.getColorAccentRowStyle(
                  isCustomSelected ? accent : null,
                ),
              ]}>
              <View style={[styles.flexColumn, styles.flex1]}>
                <Text style={[styles.textNormal, styles.textStrong]}>
                  {translate('colorPaletteScreen.custom.label')}
                </Text>
                <Text style={[styles.textMicroSupporting, styles.mt1]}>
                  {translate('colorPaletteScreen.custom.description')}
                </Text>
                {customPalette ? (
                  <View style={[styles.flexRow, styles.mt2]}>
                    {PREVIEW_KEYS.map(key => (
                      <View
                        key={key}
                        style={[
                          {
                            width: 40,
                            height: 22,
                            borderRadius: 6,
                            marginRight: 8,
                            backgroundColor: customPalette[key],
                          },
                          StyleUtils.getDerivedSwatchBorderStyle(
                            customPalette[key],
                          ),
                        ]}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.textMicroSupporting, styles.mt2]}>
                    {translate('colorPaletteScreen.custom.createYourOwn')}
                  </Text>
                )}
              </View>
              <View style={[styles.flexRow, styles.alignItemsCenter]}>
                {isCustomSelected ? (
                  <Icon
                    src={KirokuIcons.Checkmark}
                    fill={accent}
                    width={20}
                    height={20}
                  />
                ) : null}
                <Icon
                  src={KirokuIcons.ArrowRight}
                  fill={theme.icon}
                  width={20}
                  height={20}
                  additionalStyles={[styles.ml2]}
                />
              </View>
            </PressableWithFeedback>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

ColorPaletteScreen.displayName = 'ColorPaletteScreen';
export default ColorPaletteScreen;
