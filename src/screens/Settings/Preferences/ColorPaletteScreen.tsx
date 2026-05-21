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
import useTheme from '@hooks/useTheme';

const PALETTE_NAME_KEYS: Record<
  PaletteId,
  'classic' | 'sunset' | 'ocean' | 'mono' | 'colorblindSafe'
> = {
  CLASSIC: 'classic',
  SUNSET: 'sunset',
  OCEAN: 'ocean',
  MONO: 'mono',
  COLORBLIND_SAFE: 'colorblindSafe',
};

const PREVIEW_KEYS: ReadonlyArray<keyof SessionColorPalette> = [
  'green',
  'yellow',
  'orange',
  'red',
  'black',
];

function ColorPaletteScreen() {
  const styles = useThemeStyles();
  const theme = useTheme();
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
                `colorPaletteScreen.palettes.${PALETTE_NAME_KEYS[id]}`,
              );
              return (
                <PressableWithFeedback
                  key={id}
                  accessibilityLabel={paletteName}
                  onPress={() => onSelectPalette(id)}
                  style={[
                    styles.flexRow,
                    styles.alignItemsCenter,
                    styles.justifyContentBetween,
                    styles.p4,
                    styles.border,
                    styles.mb2,
                  ]}>
                  <View style={[styles.flexColumn, styles.flex1]}>
                    <Text style={[styles.textNormal, styles.textStrong]}>
                      {paletteName}
                    </Text>
                    <View style={[styles.flexRow, styles.mt2]}>
                      {PREVIEW_KEYS.map(key => (
                        <View
                          key={key}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            marginRight: 4,
                            backgroundColor: palette[key],
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  {isActive && (
                    <Icon
                      src={KirokuIcons.Checkmark}
                      fill={theme.iconSuccessFill}
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
