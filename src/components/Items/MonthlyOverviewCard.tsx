import {View} from 'react-native';
import {PeriodBarList} from '@components/Charts/PeriodBarList';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import Skeleton from '@components/Skeleton';
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

function diffOf(current: number, previous: number): number {
  return Number((current - previous).toFixed(1));
}

function directionOf(diff: number): Direction {
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
  /** Formatted absolute change vs. the previous period (shown after the trend arrow). */
  delta: string;
  direction: Direction;
  deltaColor: string;
  accentColor: string;
  /** When false, the trend arrow + delta row is hidden entirely. */
  showComparison: boolean;
  /**
   * When `showComparison` is on but no comparison is meaningful (future or
   * untracked month), reserve the row's height with blank space instead of
   * showing a delta — keeps the card height fixed so the calendar doesn't jump.
   */
  comparisonAvailable: boolean;
};

/** One stat in the consolidated home tile: label, current value, arrow + delta. */
function MetricColumn({
  label,
  value,
  unit,
  delta,
  direction,
  deltaColor,
  accentColor,
  showComparison,
  comparisonAvailable,
}: MetricColumnProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  // Blank, height-reserving line when there's nothing to compare (future or
  // untracked month); otherwise the trend arrow + delta, or "No change".
  let comparisonLine = ' ';
  if (comparisonAvailable) {
    comparisonLine =
      direction === 'flat'
        ? translate('homeScreen.stats.noChange')
        : `${ARROW[direction]} ${delta}`;
  }

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
            comparisonAvailable ? {color: deltaColor} : undefined,
          ]}
          numberOfLines={1}>
          {comparisonLine}
        </Text>
      ) : null}
    </View>
  );
}

type MonthlyOverviewCardProps = {
  /** Month stats from `useHomeStats` (self) or `useUserMonthlyStats` (profile). */
  stats: MonthlyStats;
  /** Show the card's title row text. */
  showTitle?: boolean;
  /** Title text; defaults to the localized "This month". */
  title?: string;
  /** Show the per-week units bar chart beneath the columns. */
  showWeeklyUnits?: boolean;
  /** Show the month-over-month comparison (trend arrow + delta). */
  showMonthComparison?: boolean;
  /**
   * When true (default), the whole card is tappable and opens the Statistics
   * screen. Set false (e.g. on a friend's profile) to render static content.
   */
  interactive?: boolean;
  /** Show the right-arrow shortcut affordance. Defaults to true. */
  showArrow?: boolean;
};

/**
 * Reusable "This month" stats card: three columns (Units, Sessions,
 * Alcohol-free) for a month. Each column shows the current value and, when
 * `showMonthComparison` is on, a trend arrow + the change vs. the previous
 * month. An optional per-week bar chart sits below when `showWeeklyUnits` is on. When
 * `interactive` is on (default), the whole card is tappable and opens the
 * Statistics screen. Presentational — the caller supplies `stats` (home or
 * profile), so it works for self and others.
 */
function MonthlyOverviewCard({
  stats,
  showTitle = true,
  title,
  showWeeklyUnits = true,
  showMonthComparison = true,
  interactive = true,
  showArrow = true,
}: MonthlyOverviewCardProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {
    isLoading,
    current,
    previous,
    subPeriods,
    liveExtraUnits,
    isCurrentMonth,
    comparisonAvailable,
  } = stats;

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
  const unitsDiff = diffOf(unitsCurrent, previous.totalUnits);
  const unitsDir = directionOf(unitsDiff);
  const sessionsDiff = diffOf(current.sessions, previous.sessions);
  const sessionsDir = directionOf(sessionsDiff);
  const afDiff = diffOf(current.afDays, previous.afDays);
  const afDir = directionOf(afDiff);

  const cardStyle = [
    styles.mv2,
    styles.p3,
    styles.flexRow,
    styles.alignItemsCenter,
    {backgroundColor: theme.cardSoftBG, borderRadius: 12},
  ];

  const content = (
    <>
      <View style={styles.flex1}>
        {showTitle ? (
          <Text
            style={[styles.textLabelSupporting, styles.textStrong, styles.mb1]}
            numberOfLines={1}>
            {title ?? translate('homeScreen.stats.thisMonth')}
            {/* Qualify only the in-progress month, inline on the title, so the
                comparison basis costs no extra vertical space. */}
            {showMonthComparison && comparisonAvailable && isCurrentMonth ? (
              <Text style={styles.textLabelSupporting}>
                {` · ${translate('homeScreen.stats.monthToDate')}`}
              </Text>
            ) : null}
          </Text>
        ) : null}

        <View style={styles.flexRow}>
          <MetricColumn
            label={translate('homeScreen.stats.units')}
            value={formatUnits(unitsCurrent)}
            delta={formatUnits(Math.abs(unitsDiff))}
            direction={unitsDir}
            deltaColor={deltaColorFor(unitsDir, 'lower-is-supportive')}
            accentColor={theme.text}
            showComparison={showMonthComparison}
            comparisonAvailable={comparisonAvailable}
          />
          <MetricColumn
            label={translate('homeScreen.stats.sessions')}
            value={String(current.sessions)}
            delta={formatUnits(Math.abs(sessionsDiff))}
            direction={sessionsDir}
            deltaColor={deltaColorFor(sessionsDir, 'lower-is-supportive')}
            accentColor={theme.text}
            showComparison={showMonthComparison}
            comparisonAvailable={comparisonAvailable}
          />
          <MetricColumn
            label={translate('homeScreen.stats.alcoholFree')}
            value={String(current.afDays)}
            unit={`/${current.elapsedDays}`}
            delta={formatUnits(Math.abs(afDiff))}
            direction={afDir}
            deltaColor={deltaColorFor(afDir, 'higher-is-supportive')}
            accentColor={theme.successHover}
            showComparison={showMonthComparison}
            comparisonAvailable={comparisonAvailable}
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

      {showArrow ? (
        <View style={styles.ml2}>
          <Icon
            src={KirokuIcons.ArrowRight}
            width={16}
            height={16}
            fill={theme.icon}
          />
        </View>
      ) : null}
    </>
  );

  if (!interactive) {
    return <View style={cardStyle}>{content}</View>;
  }

  return (
    <PressableWithFeedback
      accessibilityLabel={translate('homeScreen.stats.viewStatistics')}
      accessibilityRole="button"
      onPress={() => Navigation.navigate(ROUTES.STATISTICS)}
      style={cardStyle}>
      {content}
    </PressableWithFeedback>
  );
}

MonthlyOverviewCard.displayName = 'MonthlyOverviewCard';

/**
 * Placeholder that mirrors MonthlyOverviewCard's footprint (margin + height for
 * the title + three columns, no weekly chart). Shared by the home and profile
 * skeletons so the swap-in doesn't jolt the layout.
 */
function MonthlyOverviewCardSkeleton() {
  const styles = useThemeStyles();
  return (
    <View style={styles.mv2}>
      <Skeleton height={110} radius={12} />
    </View>
  );
}

export default MonthlyOverviewCard;
export {MonthlyOverviewCardSkeleton};
export type {MonthlyOverviewCardProps};
