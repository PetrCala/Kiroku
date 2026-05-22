import React, {useMemo, useState} from 'react';
import {Alert, View} from 'react-native';
import type {DateData} from 'react-native-calendars';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {eachDayOfInterval, endOfMonth, format, startOfMonth} from 'date-fns';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import Switch from '@components/Switch';
import Text from '@components/Text';
import {PressableWithFeedback} from '@components/Pressable';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import * as Preferences from '@userActions/Preferences';
import {dateToDateData} from '@libs/DataHandling';
import type {SessionColorPalette} from '@src/types/onyx';
import type {PaletteId} from '@libs/SessionColorPalettes';
import {
  PALETTE_IDS,
  PALETTES,
  DEFAULT_PALETTE_ID,
  getPaletteIdFromColors,
} from '@libs/SessionColorPalettes';
import SessionsCalendarView from '@components/SessionsCalendar/SessionsCalendarView';
import useTheme from '@hooks/useTheme';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import CONST from '@src/CONST';

const PREVIEW_KEYS: ReadonlyArray<keyof SessionColorPalette> = [
  'green',
  'yellow',
  'orange',
  'red',
  'black',
];

/**
 * Build a fixed demo dataset showcasing all five severity colors across the
 * visible month. Mirrors the shape produced by `useLazyMarkedDates` so the
 * presentational `SessionsCalendarView` renders identically.
 */
function buildPreviewMarkedData(
  palette: SessionColorPalette,
  visibleDate: DateData,
): {markedDates: MarkedDates; unitsMap: Map<DateString, number>} {
  const monthStart = startOfMonth(new Date(visibleDate.timestamp));
  const monthEnd = endOfMonth(new Date(visibleDate.timestamp));
  const allDays = eachDayOfInterval({start: monthStart, end: monthEnd});

  const overlay = new Map<
    number,
    {slot: keyof SessionColorPalette; units: number}
  >([
    [3, {slot: 'yellow', units: 2}],
    [5, {slot: 'yellow', units: 3}],
    [7, {slot: 'orange', units: 7}],
    [10, {slot: 'red', units: 12}],
    [12, {slot: 'yellow', units: 1}],
    [14, {slot: 'orange', units: 8}],
    [17, {slot: 'red', units: 14}],
    [20, {slot: 'orange', units: 6}],
    [23, {slot: 'yellow', units: 3}],
    [25, {slot: 'black', units: 20}],
    [27, {slot: 'orange', units: 9}],
  ]);

  const markedDates: MarkedDates = {};
  const unitsMap = new Map<DateString, number>();

  allDays.forEach(day => {
    const dayKey = format(day, CONST.DATE.FNS_FORMAT_STRING) as DateString;
    const o = overlay.get(day.getDate());
    if (o) {
      markedDates[dayKey] = {color: palette[o.slot]};
      unitsMap.set(dayKey, o.units);
    } else {
      markedDates[dayKey] = {color: palette.green};
    }
  });

  return {markedDates, unitsMap};
}

function ColorPaletteScreen() {
  const styles = useThemeStyles();
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

  const visibleDate = useMemo(() => dateToDateData(new Date()), []);
  const previewData = useMemo(
    () => buildPreviewMarkedData(PALETTES[displayPaletteId], visibleDate),
    [displayPaletteId, visibleDate],
  );

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
      <ScrollView style={[styles.flexGrow1, styles.mnw100]}>
        <Section
          title={translate('colorPaletteScreen.title')}
          titleStyles={styles.generalSectionTitle}
          subtitle={translate('colorPaletteScreen.description')}
          subtitleMuted
          isCentralPane
          childrenStyles={styles.pt3}>
          <View
            style={[
              styles.mb4,
              styles.overflowHidden,
              {borderRadius: 12, borderWidth: 1, borderColor: accentTint},
            ]}>
            <SessionsCalendarView
              markedDates={previewData.markedDates}
              unitsMap={previewData.unitsMap}
              visibleDate={visibleDate}
              hideArrows
              hideMonthHeader
              hideDayNames
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
        </Section>
      </ScrollView>
    </ScreenWrapper>
  );
}

ColorPaletteScreen.displayName = 'ColorPaletteScreen';
export default ColorPaletteScreen;
