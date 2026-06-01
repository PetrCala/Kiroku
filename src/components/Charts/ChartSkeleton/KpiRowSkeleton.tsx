import {View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import variables from '@styles/variables';

type KpiRowSkeletonProps = {
  height: number;
  accessibilityLabel: string;
  /**
   * Number of tiles to render. Defaults to the responsive column count so the
   * row fills one line. Pass an explicit count to mirror a specific
   * `KpiCardGroup` (e.g. 2 for the wins group, 3 for load/risk) — tiles wrap
   * onto subsequent lines exactly like the real group.
   */
  count?: number;
};

/**
 * Row of KPI placeholder tiles. Uses a raw width breakpoint instead of
 * `useResponsiveLayout` so this loading placeholder doesn't drag
 * react-navigation transitively into every chart component that touches
 * ChartSkeleton — that hook is the heaviest dep in the chart layer and a
 * skeleton has no need for navigation context. The KPI tile is inlined to
 * avoid a ChartSkeleton ↔ KpiRowSkeleton import cycle.
 */
function KpiRowSkeleton({
  height,
  accessibilityLabel,
  count,
}: KpiRowSkeletonProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const {windowWidth} = useWindowDimensions();
  const isNarrow = windowWidth < variables.mobileResponsiveWidthBreakpoint;
  const columns = isNarrow ? 2 : 3;
  const itemWidth = `${100 / columns}%` as const;
  const tiles = count ?? columns;
  const fill = theme.borderLighter;
  const cardFill = theme.highlightBG;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[styles.flexRow, styles.flexWrap, {marginHorizontal: -4}]}>
      {Array.from({length: tiles}, (_v, i) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={`kpi-${i}`}
          style={[styles.ph1, styles.pv1, {width: itemWidth}]}>
          <View
            style={[
              styles.p3,
              styles.justifyContentBetween,
              {
                height,
                backgroundColor: cardFill,
                borderRadius: 12,
              },
            ]}>
            <View
              style={{
                height: 10,
                width: '50%',
                backgroundColor: fill,
                borderRadius: 2,
              }}
            />
            <View
              style={{
                height: 24,
                width: '40%',
                backgroundColor: fill,
                borderRadius: 4,
              }}
            />
            <View
              style={{
                height: 10,
                width: '60%',
                backgroundColor: fill,
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export default KpiRowSkeleton;
