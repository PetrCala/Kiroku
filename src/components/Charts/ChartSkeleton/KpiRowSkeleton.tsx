import {View} from 'react-native';
import Skeleton from '@components/Skeleton';
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
  const styles = useThemeStyles();
  const {windowWidth} = useWindowDimensions();
  const isNarrow = windowWidth < variables.mobileResponsiveWidthBreakpoint;
  const columns = isNarrow ? 2 : 3;
  const itemWidth = `${100 / columns}%` as const;
  const tiles = count ?? columns;
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
          {/* Whole tile shimmers — small inner bars read as static, so the tile
           *  itself is the placeholder block (matches the `kpi`/`card` variant). */}
          <Skeleton width="100%" height={height} radius={12} />
        </View>
      ))}
    </View>
  );
}

export default KpiRowSkeleton;
