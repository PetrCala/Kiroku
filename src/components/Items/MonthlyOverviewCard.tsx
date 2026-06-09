import {View} from 'react-native';
import {PeriodBarList} from '@components/Charts/PeriodBarList';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@navigation/Navigation';
import type {MonthlyStats} from '@libs/Statistics/overview';
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
  const {translate} = useLocalize();
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
          {direction === 'flat'
            ? translate('homeScreen.stats.noChange')
            : `${ARROW[direction]} ${previous}`}
        </Text>
      ) : null}
    </View>
  );
}

type MonthlyOverviewCardProps = {
  /** Month stats from `useHomeStats` (self) or `useUserMonthlyStats` (profile). */
  stats: MonthlyStats;
  /** Show the card's title row text. The arrow shortcut stays either way. */
  showTitle?: boolean;
  /** Title text; defaults to the localized "This month". */
  title?: string;
  /** Show the per-week units bar chart beneath the columns. */
  showWeeklyUnits?: boolean;
  /** Show the month-over-month comparison (trend arrow + previous value). */
  showMonthComparison?: boolean;
};

/**
 * Reusable "This month" stats card: three columns (Units, Sessions,
 * Alcohol-free) for a month. Each column shows the current value and, when
 * `showMonthComparison` is on, a trend arrow + the previous month's value. An
 * optional per-week bar chart sits below when `showWeeklyUnits` is on. The
 * whole card is tappable and opens the Statistics screen. Presentational — the
 * caller supplies `stats` (home or profile), so it works for self and others.
 */
function MonthlyOverviewCard({
  stats,
  showTitle = true,
  title,
  showWeeklyUnits = true,
  showMonthComparison = true,
}: MonthlyOverviewCardProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {isLoading, current, previous, subPeriods, liveExtraUnits} = stats;

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
    <PressableWithFeedback
      accessibilityLabel={translate('homeScreen.stats.viewStatistics')}
      accessibilityRole="button"
      onPress={() => Navigation.navigate(ROUTES.STATISTICS)}
      style={[
        styles.mv2,
        styles.p3,
        styles.flexRow,
        styles.alignItemsCenter,
        {backgroundColor: theme.cardSoftBG, borderRadius: 12},
      ]}>
      <View style={styles.flex1}>
        {showTitle ? (
          <Text
            style={[styles.textLabelSupporting, styles.textStrong, styles.mb1]}
            numberOfLines={1}>
            {title ?? translate('homeScreen.stats.thisMonth')}
          </Text>
        ) : null}

        <View style={styles.flexRow}>
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

      <View style={styles.ml2}>
        <Icon
          src={KirokuIcons.ArrowRight}
          width={16}
          height={16}
          fill={theme.icon}
        />
      </View>
    </PressableWithFeedback>
  );
}

MonthlyOverviewCard.displayName = 'MonthlyOverviewCard';

export default MonthlyOverviewCard;
export type {MonthlyOverviewCardProps};
