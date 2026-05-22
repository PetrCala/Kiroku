import {View} from 'react-native';
import Text from '@components/Text';
import {PressableWithFeedback} from '@components/Pressable';
import {Sparkline} from '@components/Charts/Sparkline';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {ChartDatum} from '@libs/Statistics';

type KpiCardTone = 'neutral' | 'supportive' | 'celebratory';

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
  /** Wires Tier 2 drill-down. No-op in v1. */
  onPress?: () => void;
  accessibilityLabel?: string;
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
  onPress,
  accessibilityLabel,
}: KpiCardProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  let accentColor = theme.text;
  if (tone === 'celebratory') {
    accentColor = theme.successHover;
  } else if (tone === 'supportive') {
    accentColor = theme.success;
  }

  // "Down" trend (less drinking) is supportive; "up" is a gentle warning.
  // Flat or no delta uses the muted text color.
  let deltaColor = theme.textSupporting;
  if (delta && delta.direction === 'down') {
    deltaColor = theme.success;
  } else if (delta && delta.direction === 'up') {
    deltaColor = theme.warning;
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
export type {KpiCardProps, KpiCardTone, KpiCardDelta};
