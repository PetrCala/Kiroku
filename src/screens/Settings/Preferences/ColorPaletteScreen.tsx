import React, {useState} from 'react';
import {Alert, View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
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
import {sessionPaletteColors} from '@styles/theme/colors';

// Brand orange (tangerine400) — fixed across themes so the selection accent stays on-brand.
const ACCENT = sessionPaletteColors.brand.orange;
// ~8% opacity orange wash for the selected-row background.
const ACCENT_TINT = `${ACCENT}1F`;

const PREVIEW_KEYS: ReadonlyArray<keyof SessionColorPalette> = [
  'green',
  'yellow',
  'orange',
  'red',
  'black',
];

function ColorPaletteScreen() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const {preferences} = useDatabaseData();
  const [saving, setSaving] = useState(false);

  const activePaletteId =
    getPaletteIdFromColors(preferences?.session_color_palette) ??
    DEFAULT_PALETTE_ID;

  const onSelectPalette = (id: PaletteId) => {
    (async () => {
      try {
        setSaving(true);
        await Preferences.updatePreferences(db, user, {
          session_color_palette: PALETTES[id],
        });
        Navigation.goBack();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('preferencesScreen.error.save'), errorMessage);
      } finally {
        setSaving(false);
      }
    })();
  };

  if (saving) {
    return (
      <FullScreenLoadingIndicator
        loadingText={translate('preferencesScreen.saving')}
      />
    );
  }

  return (
    <ScreenWrapper testID={ColorPaletteScreen.displayName}>
      <HeaderWithBackButton
        title={translate('colorPaletteScreen.title')}
        shouldShowBackButton
        onBackButtonPress={() => Navigation.goBack()}
        onCloseButtonPress={() => Navigation.dismissModal()}
      />
      <ScrollView style={[styles.flexGrow1, styles.mnw100]}>
        <Section
          title={translate('colorPaletteScreen.title')}
          titleStyles={styles.generalSectionTitle}
          subtitle={translate('colorPaletteScreen.description')}
          subtitleMuted
          isCentralPane
          childrenStyles={styles.pt3}>
          <View>
            {PALETTE_IDS.map(id => {
              const palette = PALETTES[id];
              const isActive = id === activePaletteId;
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
                      borderLeftColor: isActive ? ACCENT : 'transparent',
                      backgroundColor: isActive ? ACCENT_TINT : 'transparent',
                    },
                  ]}>
                  <View style={[styles.flexColumn, styles.flex1]}>
                    <Text
                      style={[
                        styles.textNormal,
                        styles.textStrong,
                        isActive ? {color: ACCENT} : null,
                      ]}>
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
                      fill={ACCENT}
                      width={20}
                      height={20}
                    />
                  )}
                </PressableWithFeedback>
              );
            })}
          </View>
        </Section>
      </ScrollView>
    </ScreenWrapper>
  );
}

ColorPaletteScreen.displayName = 'ColorPaletteScreen';
export default ColorPaletteScreen;
