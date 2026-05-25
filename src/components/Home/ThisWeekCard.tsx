import React, {useMemo} from 'react';
import {View} from 'react-native';
import {format} from 'date-fns';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useTheme from '@hooks/useTheme';
import useResolvedPalette from '@hooks/useResolvedPalette';
import {convertUnitsToColors} from '@libs/DataHandling';
import {isLightHex} from '@libs/SessionColorPalettes';
import CONST from '@src/CONST';
import type {Preferences} from '@src/types/onyx';
import type {WeekDay, WeekSummary} from './useHomeWeekStats';

type ThisWeekCardProps = {
  days: WeekDay[];
  summary: WeekSummary;
  preferences: Preferences;
};

function ThisWeekCard({days, summary, preferences}: ThisWeekCardProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const palette = useResolvedPalette(preferences);

  // Locale-aware short day name (M/T/W/T/F/S/S). Cached per day so we don't
  // recreate an Intl.DateTimeFormat on every render.
  const dayLetters = useMemo(
    () => days.map(d => format(d.date, 'EEEEE')),
    [days],
  );

  return (
    <View style={styles.homeWeekCard}>
      <Text style={styles.homeWeekCardTitle}>
        {translate('homeScreen.stats.thisWeek')}
      </Text>
      <View style={styles.homeWeekRow}>
        {days.map((d, i) => {
          const hasUnits = d.units > 0;
          const color = hasUnits
            ? convertUnitsToColors(
                d.units,
                preferences.units_to_colors,
                preferences.session_color_palette,
              )
            : null;
          let textColor: string = theme.textSupporting;
          if (color) {
            textColor = isLightHex(color)
              ? CONST.CALENDAR_COLORS.TEXT.BLACK
              : CONST.CALENDAR_COLORS.TEXT.WHITE;
          }

          const pillStyles = [
            styles.homeWeekDayPill,
            d.isFuture && styles.homeWeekDayPillFuture,
            color ? {backgroundColor: color} : null,
            d.isToday && {borderColor: palette.yellow},
            d.isToday && styles.homeWeekDayPillToday,
          ];

          return (
            <View key={d.date.toISOString()} style={pillStyles}>
              <Text style={[styles.homeWeekDayName, {color: textColor}]}>
                {dayLetters[i]}
              </Text>
              {!d.isFuture && (
                <Text style={[styles.homeWeekDayValue, {color: textColor}]}>
                  {format(d.date, 'd')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.homeWeekSummary}>
        <View style={styles.homeWeekSummaryItem}>
          <Text style={styles.homeWeekSummaryValue}>{summary.sessions}</Text>
          <Text style={styles.homeWeekSummaryLabel}>
            {translate('homeScreen.stats.weekSummary.sessions')}
          </Text>
        </View>
        <View style={styles.homeWeekSummaryItem}>
          <Text style={styles.homeWeekSummaryValue}>
            {Math.round(summary.units * 10) / 10}
          </Text>
          <Text style={styles.homeWeekSummaryLabel}>
            {translate('homeScreen.stats.weekSummary.units')}
          </Text>
        </View>
        <View style={styles.homeWeekSummaryItem}>
          <Text style={[styles.homeWeekSummaryValue, {color: theme.success}]}>
            {summary.quietDays}
          </Text>
          <Text style={[styles.homeWeekSummaryLabel, {color: theme.success}]}>
            {translate('homeScreen.stats.weekSummary.quietDays')}
          </Text>
        </View>
      </View>
    </View>
  );
}

ThisWeekCard.displayName = 'ThisWeekCard';
export default ThisWeekCard;
