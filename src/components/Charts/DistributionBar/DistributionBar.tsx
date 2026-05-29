import {View} from 'react-native';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

type DistributionSegment = {
  label: string;
  value: number;
  color: string;
};

type DistributionBarProps = {
  segments: DistributionSegment[];
  accessibilityLabel: string;
  /** Show the color-keyed legend row below the bar. Default true. */
  showLegend?: boolean;
  isLoading?: boolean;
};

const BAR_HEIGHT = 12;

/**
 * Thin segmented bar showing how a whole (e.g. a period's elapsed days) splits
 * across labeled, colored bands. Segment widths are proportional to value;
 * zero-value segments are omitted from the bar but still listed in the legend
 * so the band set reads consistently. An all-zero total renders an empty
 * muted track.
 */
function DistributionBar({
  segments,
  accessibilityLabel,
  showLegend = true,
  isLoading,
}: DistributionBarProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  if (isLoading) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={{height: BAR_HEIGHT}}
      />
    );
  }

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <View
        style={[
          styles.flexRow,
          {
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            backgroundColor: theme.border,
            overflow: 'hidden',
          },
        ]}>
        {total > 0
          ? segments.map(segment =>
              segment.value > 0 ? (
                <View
                  key={segment.label}
                  style={{
                    flexGrow: segment.value,
                    flexBasis: 0,
                    backgroundColor: segment.color,
                  }}
                />
              ) : null,
            )
          : null}
      </View>
      {showLegend ? (
        <View style={[styles.flexRow, styles.flexWrap, styles.mt2]}>
          {segments.map(segment => (
            <View
              key={segment.label}
              style={[styles.flexRow, styles.alignItemsCenter, styles.mr3]}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: segment.color,
                  marginRight: 4,
                }}
              />
              <Text style={styles.textMicroSupporting}>
                {segment.label} {segment.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default DistributionBar;
export type {DistributionBarProps, DistributionSegment};
