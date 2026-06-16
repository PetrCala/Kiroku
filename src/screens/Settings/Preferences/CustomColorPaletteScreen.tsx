import React, {useCallback, useState} from 'react';
import {Alert, View} from 'react-native';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import useFeatureAccessGuard from '@hooks/useFeatureAccessGuard';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import Button from '@components/Button';
import BottomActionBar from '@components/BottomActionBar';
import {PressableWithFeedback} from '@components/Pressable';
import ColorPicker from '@components/ColorPicker';
import * as Preferences from '@userActions/Preferences';
import type {SessionColorPalette} from '@src/types/onyx';
import {resolvePalette} from '@libs/SessionColorPalettes';
import PaletteWeekPreview from './PaletteWeekPreview';

// The five severity bands, ordered low → high, that make up a palette.
const BAND_KEYS: ReadonlyArray<keyof SessionColorPalette> = [
  'green',
  'yellow',
  'orange',
  'red',
  'black',
];

function CustomColorPaletteScreen() {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  const {translate} = useLocalize();
  const preferences = useCurrentUserPreferences();

  // Premium gate: redirects to the palette list once we know the feature is
  // locked, and lets us avoid flashing the editor to a locked user.
  const access = useFeatureAccessGuard('CUSTOM_COLOR_PALETTE');

  // Seed from the saved custom slot when present, otherwise from the active
  // palette so the user starts from whatever they already see.
  const [draft, setDraft] = useState<SessionColorPalette>(
    () =>
      preferences?.custom_session_color_palette ??
      resolvePalette(preferences?.session_color_palette),
  );
  const [selectedBand, setSelectedBand] =
    useState<keyof SessionColorPalette>('green');
  const [saving, setSaving] = useState(false);

  const accent = theme.appColor;

  const handleColorChange = useCallback(
    (hex: string) => {
      setDraft(prev => ({...prev, [selectedBand]: hex}));
    },
    [selectedBand],
  );

  const handleSave = useCallback(() => {
    setSaving(true);
    // Persist the custom slot AND make it the active palette in one write.
    Preferences.updatePreferences({
      custom_session_color_palette: draft,
      session_color_palette: draft,
    })
      .then(() => {
        Navigation.goBack();
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('preferencesScreen.error.save'), errorMessage);
      })
      .finally(() => setSaving(false));
  }, [draft, translate]);

  // While supporter status hydrates, show a spinner rather than the editor so a
  // locked user never glimpses the picker before the guard redirects.
  if (access.isResolving) {
    return (
      <ScreenWrapper testID={CustomColorPaletteScreen.displayName}>
        <HeaderWithBackButton
          title={translate('colorPaletteScreen.editor.title')}
          shouldShowBackButton
          onBackButtonPress={() => Navigation.goBack()}
          onCloseButtonPress={() => Navigation.dismissModal()}
        />
        <FullScreenLoadingIndicator />
      </ScreenWrapper>
    );
  }

  // Locked: the guard's effect is redirecting; render nothing in the meantime.
  if (access.isLocked) {
    return null;
  }

  return (
    <ScreenWrapper testID={CustomColorPaletteScreen.displayName}>
      <HeaderWithBackButton
        title={translate('colorPaletteScreen.editor.title')}
        shouldShowBackButton
        onBackButtonPress={() => Navigation.goBack()}
        onCloseButtonPress={() => Navigation.dismissModal()}
      />
      <ScrollView
        style={[styles.flexGrow1, styles.mnw100]}
        contentContainerStyle={styles.pb5}>
        <PaletteWeekPreview palette={draft} />
        <View style={[styles.ph5, styles.pt3]}>
          <Text style={[styles.textMicroSupporting, styles.mb3]}>
            {translate('colorPaletteScreen.editor.selectBand')}
          </Text>
          <View
            style={[styles.flexRow, styles.justifyContentBetween, styles.mb5]}>
            {BAND_KEYS.map(key => {
              const isSelected = key === selectedBand;
              const bandLabel = translate(
                `colorPaletteScreen.bands.${key}` as const,
              );
              return (
                <PressableWithFeedback
                  key={key}
                  accessibilityLabel={bandLabel}
                  accessibilityState={{selected: isSelected}}
                  onPress={() => setSelectedBand(key)}
                  style={[styles.alignItemsCenter, styles.flex1]}>
                  <View
                    style={[
                      styles.paletteBandChip,
                      StyleUtils.getBackgroundColorStyle(draft[key]),
                      isSelected
                        ? [
                            styles.paletteBandChipSelected,
                            StyleUtils.getBorderColorStyle(accent),
                          ]
                        : StyleUtils.getDerivedSwatchBorderStyle(draft[key]),
                    ]}
                  />
                  <Text
                    style={[
                      styles.textMicroSupporting,
                      styles.mt1,
                      styles.textAlignCenter,
                      isSelected ? StyleUtils.getColorStyle(accent) : undefined,
                    ]}
                    numberOfLines={1}>
                    {bandLabel}
                  </Text>
                </PressableWithFeedback>
              );
            })}
          </View>
          <ColorPicker
            key={selectedBand}
            value={draft[selectedBand]}
            onChange={handleColorChange}
            hexInputLabel={translate('colorPaletteScreen.hex.label')}
            hexInputPlaceholder={translate(
              'colorPaletteScreen.hex.placeholder',
            )}
            hexErrorText={translate('colorPaletteScreen.hex.invalid')}
          />
        </View>
      </ScrollView>
      <BottomActionBar containerStyle={styles.p5}>
        <Button
          large
          success
          isLoading={saving}
          text={translate('colorPaletteScreen.editor.save')}
          onPress={handleSave}
          style={styles.bottomTabButton}
        />
      </BottomActionBar>
    </ScreenWrapper>
  );
}

CustomColorPaletteScreen.displayName = 'CustomColorPaletteScreen';
export default CustomColorPaletteScreen;
