import {View} from 'react-native';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

type BarListItem = {
  label: string;
  value: number;
};

type BarListProps = {
  items: BarListItem[];
  accessibilityLabel: string;
  /** Formats the trailing value. Defaults to a trimmed number. */
  formatValue?: (value: number) => string;
  /** Bar fill color. Defaults to the theme accent. */
  barColor?: string;
  isLoading?: boolean;
};

const ROW_HEIGHT = 22;
const TRACK_HEIGHT = 8;

function defaultFormat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Compact horizontal labeled-bar list — a mobile-friendly alternative to a
 * dense table. Each row is `label … ▮▮▮ value`, the bar scaled to the largest
 * value in the set. Rows with value 0 still render their label and a `0`, so
 * an empty sub-period reads as "nothing here" rather than vanishing.
 */
function BarList({
  items,
  accessibilityLabel,
  formatValue = defaultFormat,
  barColor,
  isLoading,
}: BarListProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const fill = barColor ?? theme.appColor;

  if (isLoading) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={{height: items.length ? items.length * ROW_HEIGHT : ROW_HEIGHT}}
      />
    );
  }

  const max = items.reduce((m, item) => Math.max(m, item.value), 0);

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      {items.map(item => {
        const widthPercent = max > 0 ? (item.value / max) * 100 : 0;
        return (
          <View
            key={item.label}
            style={[
              styles.flexRow,
              styles.alignItemsCenter,
              {height: ROW_HEIGHT},
            ]}>
            <Text
              style={[styles.textMicroSupporting, {width: 36}]}
              numberOfLines={1}>
              {item.label}
            </Text>
            <View
              style={[
                styles.flex1,
                styles.mh1,
                {
                  height: TRACK_HEIGHT,
                  borderRadius: TRACK_HEIGHT / 2,
                  backgroundColor: theme.border,
                  overflow: 'hidden',
                },
              ]}>
              <View
                style={{
                  width: `${widthPercent}%`,
                  height: '100%',
                  borderRadius: TRACK_HEIGHT / 2,
                  backgroundColor: fill,
                }}
              />
            </View>
            <Text
              style={[styles.textMicro, styles.textStrong, {width: 34}]}
              numberOfLines={1}>
              {formatValue(item.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default BarList;
export type {BarListItem, BarListProps};
