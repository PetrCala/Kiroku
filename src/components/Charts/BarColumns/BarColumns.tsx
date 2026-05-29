import {View} from 'react-native';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

type BarColumnsItem = {
  label: string;
  value: number;
};

type BarColumnsProps = {
  items: BarColumnsItem[];
  accessibilityLabel: string;
  /** Formats the value shown above each bar. Defaults to a trimmed number. */
  formatValue?: (value: number) => string;
  /** Bar fill color. Defaults to the theme accent. */
  barColor?: string;
  isLoading?: boolean;
};

const CHART_HEIGHT = 100;
// Vertical pixels the tallest bar may occupy, leaving room for the value label
// above and the category label below within CHART_HEIGHT.
const BAR_AREA = 64;
// A non-zero period still shows a sliver so "a little" never reads as "nothing".
const MIN_VISIBLE_HEIGHT = 3;

function defaultFormat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Compact vertical bar chart — the vertical complement to {@link BarList}.
 * One column per item with its value above and a short label below, bars
 * scaled to the largest value in the set and sharing the label row as a
 * common baseline so heights read comparatively. Zero-value items still
 * render their label and a `0`, so an empty period reads as "nothing here"
 * rather than vanishing.
 */
function BarColumns({
  items,
  accessibilityLabel,
  formatValue = defaultFormat,
  barColor,
  isLoading,
}: BarColumnsProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const fill = barColor ?? theme.appColor;

  if (isLoading) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={{height: CHART_HEIGHT}}
      />
    );
  }

  const max = items.reduce((m, item) => Math.max(m, item.value), 0);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.flexRow, styles.alignItemsEnd, {height: CHART_HEIGHT}]}>
      {items.map(item => {
        let barHeight = 0;
        if (max > 0 && item.value > 0) {
          barHeight = Math.max(
            (item.value / max) * BAR_AREA,
            MIN_VISIBLE_HEIGHT,
          );
        }
        return (
          <View
            key={item.label}
            style={[
              styles.flex1,
              styles.alignItemsCenter,
              styles.justifyContentEnd,
            ]}>
            <Text
              style={[styles.textMicro, styles.textStrong]}
              numberOfLines={1}>
              {formatValue(item.value)}
            </Text>
            <View
              style={{
                height: barHeight,
                width: '60%',
                maxWidth: 28,
                marginTop: 2,
                backgroundColor: fill,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
              }}
            />
            <Text
              style={[styles.textMicroSupporting, styles.mt1]}
              numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default BarColumns;
export type {BarColumnsItem, BarColumnsProps};
