import {View} from 'react-native';
import Text from '@components/Text';
import {PressableWithFeedback} from '@components/Pressable';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import {Sparkline} from '@components/Charts/Sparkline';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {ChartDatum} from '@libs/Statistics';

type KpiCardTone = 'neutral' | 'supportive' | 'celebratory';

type KpiCardPolarity =
  | 'lower-is-supportive'
  | 'higher-is-supportive'
  | 'neutral';

type KpiCardDelta = {
  value: number;
  direction: 'up' | 'down' | 'flat';
  /** Pre-translated suffix, e.g. "vs last week". */
  label: string;
};

type KpiCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  delta?: KpiCardDelta;
  sparkline?: ChartDatum[];
  /** Affects styling only — switches the affirmative-framing accent. */
  tone?: KpiCardTone;
  /**
   * Controls how delta-direction maps to color. `lower-is-supportive`
   * (default) treats `down` as success and `up` as warning, matching
   * units/sessions metrics. `higher-is-supportive` inverts this for
   * additive metrics like quiet days or alcohol-free streaks. `neutral`
   * leaves the delta in the muted text color regardless of direction.
   */
  polarity?: KpiCardPolarity;
  /** Wires Tier 2 drill-down. No-op in v1. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** When true, shows a layout-faithful skeleton in place of the card. */
  isLoading?: boolean;
};

const ARROW: Record<KpiCardDelta['direction'], string> = {
  up: '▲',
  down: '▼',
  flat: '–',
};

/**
 * Summary tile in the Statistics screen's KPI hub. Renders a label, a hero
 * value (+ optional unit), an optional delta chip, and an optional inline
 * sparkline. Mirrors the `MenuItem`-style flat-API ergonomic — small set
 * of well-typed props, no chart internals leaking through.
 *
 * `onPress` is wired but the routes don't exist yet (Tier 2 detail screens
 * land in v2). Caller can leave it undefined.
 */
function KpiCard({
  label,
  value,
  unit,
  delta,
  sparkline,
  tone = 'neutral',
  polarity = 'lower-is-supportive',
  onPress,
  accessibilityLabel,
  isLoading,
}: KpiCardProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  if (isLoading) {
    return (
      <ChartSkeleton
        variant="kpi"
        accessibilityLabel={accessibilityLabel ?? label}
      />
    );
  }

  let accentColor = theme.text;
  if (tone === 'celebratory') {
    accentColor = theme.successHover;
  } else if (tone === 'supportive') {
    accentColor = theme.success;
  }

  // Delta color depends on polarity. For `lower-is-supportive` (default)
  // down=good, up=bad — matches units/sessions metrics. For
  // `higher-is-supportive` the mapping flips (quiet days, AF streaks).
  // `neutral` keeps the muted color regardless of direction.
  let deltaColor = theme.textSupporting;
  if (delta && polarity !== 'neutral') {
    const supportiveDirection: KpiCardDelta['direction'] =
      polarity === 'higher-is-supportive' ? 'up' : 'down';
    const warningDirection: KpiCardDelta['direction'] =
      polarity === 'higher-is-supportive' ? 'down' : 'up';
    if (delta.direction === supportiveDirection) {
      deltaColor = theme.success;
    } else if (delta.direction === warningDirection) {
      deltaColor = theme.warning;
    }
  }

  const body = (
    <View
      style={[
        styles.p3,
        {
          backgroundColor: theme.highlightBG,
          borderRadius: 12,
          minHeight: 96,
        },
      ]}>
      <Text style={[styles.textLabelSupporting]} numberOfLines={1}>
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
      {delta ? (
        <View style={[styles.flexRow, styles.alignItemsCenter, styles.mt1]}>
          <Text
            style={[styles.textMicro, styles.textStrong, {color: deltaColor}]}>
            {ARROW[delta.direction]} {Math.abs(delta.value)}
          </Text>
          <Text style={[styles.textMicroSupporting, styles.ml1]}>
            {delta.label}
          </Text>
        </View>
      ) : null}
      {sparkline && sparkline.length > 0 ? (
        <View style={styles.mt2}>
          <Sparkline
            data={sparkline}
            accessibilityLabel={`${label} trend`}
            height={28}
          />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <PressableWithFeedback
        onPress={onPress}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button">
        {body}
      </PressableWithFeedback>
    );
  }
  return (
    <View accessible accessibilityLabel={accessibilityLabel ?? label}>
      {body}
    </View>
  );
}

export default KpiCard;
export type {KpiCardProps, KpiCardTone, KpiCardPolarity, KpiCardDelta};
