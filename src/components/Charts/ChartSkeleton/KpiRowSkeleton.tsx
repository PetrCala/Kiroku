import {View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useWindowDimensions from '@hooks/useWindowDimensions';
import variables from '@styles/variables';

type KpiRowSkeletonProps = {
  height: number;
  accessibilityLabel: string;
};

/**
 * Row of KPI placeholder tiles. Uses a raw width breakpoint instead of
 * `useResponsiveLayout` so this loading placeholder doesn't drag
 * react-navigation transitively into every chart component that touches
 * ChartSkeleton — that hook is the heaviest dep in the chart layer and a
 * skeleton has no need for navigation context. The KPI tile is inlined to
 * avoid a ChartSkeleton ↔ KpiRowSkeleton import cycle.
 */
function KpiRowSkeleton({height, accessibilityLabel}: KpiRowSkeletonProps) {
  const theme = useTheme();
  const {windowWidth} = useWindowDimensions();
  const isNarrow = windowWidth < variables.mobileResponsiveWidthBreakpoint;
  const columns = isNarrow ? 2 : 3;
  const itemWidth = `${100 / columns}%` as const;
  const fill = theme.borderLighter;
  const cardFill = theme.highlightBG;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
      }}>
      {Array.from({length: columns}, (_v, i) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={`kpi-${i}`}
          style={{
            width: itemWidth,
            paddingHorizontal: 4,
            paddingVertical: 4,
          }}>
          <View
            style={{
              height,
              backgroundColor: cardFill,
              borderRadius: 12,
              padding: 12,
              justifyContent: 'space-between',
            }}>
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
