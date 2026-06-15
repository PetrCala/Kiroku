import type {ReactNode} from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

type ChartCardProps = {
  title: string;
  subtitle?: string;
  /** Slot to the right of the title — e.g. a per-chart toggle. */
  headerAction?: ReactNode;
  /** Slot below the chart — e.g. delta chip or period selector (v2). */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * The shell every chart sits in: rounded card with a header, body slot,
 * and optional footer. Theme-aware. No chart-specific knowledge.
 */
function ChartCard({
  title,
  subtitle,
  headerAction,
  footer,
  children,
}: ChartCardProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  return (
    <View
      style={[
        styles.p4,
        styles.mv2,
        {
          backgroundColor: theme.highlightBG,
          borderRadius: 12,
        },
      ]}>
      <View
        style={[
          styles.mb2,
          styles.flexRow,
          styles.justifyContentBetween,
          styles.alignItemsCenter,
        ]}>
        <View style={styles.flex1}>
          <Text style={[styles.textLabelSupporting, styles.textStrong]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.textMicroSupporting]}>{subtitle}</Text>
          ) : null}
        </View>
        {headerAction ?? null}
      </View>
      <View>{children}</View>
      {footer ? <View style={styles.mt3}>{footer}</View> : null}
    </View>
  );
}

export default ChartCard;
export type {ChartCardProps};
