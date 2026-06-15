import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {SessionColorPalette} from '@src/types/onyx';

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

type PaletteWeekPreviewProps = {
  /** The palette whose colors fill the preview week. */
  palette: SessionColorPalette;
};

/**
 * A live, calendar-styled preview of a single week rendered with the given
 * palette. Shared by the palette list screen and the custom palette editor so
 * both show the colors exactly as the real calendar would.
 */
function PaletteWeekPreview({palette}: PaletteWeekPreviewProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  // Subtle brand-tinted frame so the preview reads as a distinct surface.
  const accentTint = `${theme.appColor}1F`;

  return (
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
          const marking = {color: palette[cell.slot]};
          const unitsText = cell.units > 0 ? String(cell.units) : '';
          return (
            <View
              key={cell.day}
              style={StyleUtils.getSessionsCalendarDayCellStyle(
                marking,
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
  );
}

PaletteWeekPreview.displayName = 'PaletteWeekPreview';

export default PaletteWeekPreview;
