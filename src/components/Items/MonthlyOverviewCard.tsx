import {View} from 'react-native';
import type {DateData} from 'react-native-calendars';
import {PeriodBarList} from '@components/Charts/PeriodBarList';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useHomeStats from '@hooks/useHomeStats';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@navigation/Navigation';
import ROUTES from '@src/ROUTES';

type Polarity = 'lower-is-supportive' | 'higher-is-supportive';
type Direction = 'up' | 'down' | 'flat';

const ARROW: Record<Direction, string> = {up: '▲', down: '▼', flat: '–'};

function formatUnits(value: number): string {
  // 1 decimal for partial units, else integer — matches the Statistics tabs.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function directionOf(current: number, previous: number): Direction {
  const diff = Number((current - previous).toFixed(1));
  if (diff > 0) {
    return 'up';
  }
  if (diff < 0) {
    return 'down';
  }
  return 'flat';
}

type MetricColumnProps = {
  label: string;
  /** Formatted current value. */
  value: string;
  /** Optional unit suffix, e.g. "/29" for alcohol-free days. */
  unit?: string;
  /** Formatted previous value (shown after the trend arrow). */
  previous: string;
  direction: Direction;
  deltaColor: string;
  accentColor: string;
  /** When false, the trend arrow + previous value row is hidden. */
  showComparison: boolean;
};

/** One stat in the consolidated home tile: label, current value, arrow + previous. */
function MetricColumn({
  label,
  value,
  unit,
  previous,
  direction,
  deltaColor,
  accentColor,
  showComparison,
}: MetricColumnProps) {
  const styles = useThemeStyles();
  return (
    <View style={styles.flex1}>
      <Text style={styles.textLabelSupporting} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.flexRow, styles.alignItemsBaseline, styles.mt1]}>
        <Text
          style={[
            styles.textHeadline,
            {color: accentColor, fontSize: 24, lineHeight: 28},
          ]}
          numberOfLines={1}>
          {value}
        </Text>
        {unit ? (
          <Text style={[styles.textMicroSupporting, styles.ml1]}>{unit}</Text>
        ) : null}
      </View>
      {showComparison ? (
        <Text
          style={[
            styles.textMicro,
            styles.textStrong,
            styles.mt1,
            {color: deltaColor},
          ]}
          numberOfLines={1}>
          {ARROW[direction]} {previous}
        </Text>
      ) : null}
    </View>
  );
}

type MonthlyOverviewCardProps = {
  visibleDate: DateData;
  /** Show the card's title row text. The arrow shortcut stays either way. */
  showTitle?: boolean;
  /** Title text; defaults to the localized "Monthly overview". */
  title?: string;
  /** Show the per-week units bar chart beneath the columns. */
  showWeeklyUnits?: boolean;
  /** Show the month-over-month comparison (trend arrow + previous value). */
  showMonthComparison?: boolean;
};

/**
 * Reusable "Monthly overview" stats card: three columns (Units, Sessions,
 * Alcohol-free) for the visible month. Each column shows the current value and,
 * when `showMonthComparison` is on, a trend arrow + the previous month's value.
 * An optional per-week bar chart sits below when `showWeeklyUnits` is on, and a
 * quiet arrow shortcut opens the Statistics screen. Used on the home screen and
 * intended for the profile screens (self + other users).
 */
function MonthlyOverviewCard({
  visibleDate,
  showTitle = true,
  title,
  showWeeklyUnits = true,
  showMonthComparison = true,
}: MonthlyOverviewCardProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {isLoading, current, previous, subPeriods, liveExtraUnits} =
    useHomeStats(visibleDate);

  const deltaColorFor = (direction: Direction, polarity: Polarity): string => {
    if (direction === 'flat') {
      return theme.textSupporting;
    }
    const supportive: Direction =
      polarity === 'higher-is-supportive' ? 'up' : 'down';
    return direction === supportive ? theme.success : theme.warning;
  };

  // The hero Units value folds in the live session's units (see useHomeStats).
  const unitsCurrent = current.totalUnits + liveExtraUnits;
  const unitsDir = directionOf(unitsCurrent, previous.totalUnits);
  const sessionsDir = directionOf(current.sessions, previous.sessions);
  const afDir = directionOf(current.afDays, previous.afDays);

  return (
    <View style={styles.mv2}>
      <View
        style={[
          styles.p3,
          {backgroundColor: theme.cardSoftBG, borderRadius: 12},
        ]}>
        <View
          style={[
            styles.flexRow,
            styles.alignItemsCenter,
            showTitle ? styles.justifyContentBetween : styles.justifyContentEnd,
          ]}>
          {showTitle ? (
            <Text
              style={[styles.textLabelSupporting, styles.textStrong]}
              numberOfLines={1}>
              {title ?? translate('homeScreen.stats.thisMonth')}
            </Text>
          ) : null}
          <PressableWithFeedback
            accessibilityLabel={translate('homeScreen.stats.viewStatistics')}
            accessibilityRole="button"
            onPress={() => Navigation.navigate(ROUTES.STATISTICS)}>
            <Icon
              src={KirokuIcons.ArrowRight}
              width={16}
              height={16}
              fill={theme.icon}
            />
          </PressableWithFeedback>
        </View>

        <View style={[styles.flexRow, styles.mt1]}>
          <MetricColumn
            label={translate('homeScreen.stats.units')}
            value={formatUnits(unitsCurrent)}
            previous={formatUnits(previous.totalUnits)}
            direction={unitsDir}
            deltaColor={deltaColorFor(unitsDir, 'lower-is-supportive')}
            accentColor={theme.text}
            showComparison={showMonthComparison}
          />
          <MetricColumn
            label={translate('homeScreen.stats.sessions')}
            value={String(current.sessions)}
            previous={String(previous.sessions)}
            direction={sessionsDir}
            deltaColor={deltaColorFor(sessionsDir, 'lower-is-supportive')}
            accentColor={theme.text}
            showComparison={showMonthComparison}
          />
          <MetricColumn
            label={translate('homeScreen.stats.alcoholFree')}
            value={String(current.afDays)}
            unit={`/${current.elapsedDays}`}
            previous={String(previous.afDays)}
            direction={afDir}
            deltaColor={deltaColorFor(afDir, 'higher-is-supportive')}
            accentColor={theme.successHover}
            showComparison={showMonthComparison}
          />
        </View>

        {showWeeklyUnits ? (
          <View style={styles.mt3}>
            <Text style={[styles.textMicroSupporting, styles.mb1]}>
              {translate('homeScreen.stats.unitsByWeek')}
            </Text>
            <PeriodBarList
              points={subPeriods}
              granularity="week"
              liveExtraUnits={liveExtraUnits}
              accessibilityLabel={translate(
                'homeScreen.stats.unitsPerWeekA11y',
              )}
              isLoading={isLoading}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

MonthlyOverviewCard.displayName = 'MonthlyOverviewCard';

export default MonthlyOverviewCard;
export type {MonthlyOverviewCardProps};
