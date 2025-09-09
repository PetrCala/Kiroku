import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';

// Generic data shape: any number of segments per bar
type StackedBarDatum<K extends string = string> = {
  x: string | number | Date; // category or time bucket
  segments: Record<K, number>; // e.g., {beer: 2.3, wine: 1.1}
};

type LegendItem<K extends string = string> = {
  id: K; // must match segments keys
  label: string;
  color?: string; // let theme supply defaults if omitted
};

type Props<K extends string = string> = {
  data: Array<StackedBarDatum<K>>;
  legend: Array<LegendItem<K>>;
  // Presentation / behavior knobs
  stacked?: boolean; // stacked vs grouped bars
  normalize100?: boolean; // show percentages (100% stacked)
  sortSegments?: 'none' | 'asc' | 'desc'; // per-bar sorting rule
  barWidth?: number;
  gap?: number; // gap between bars
  formatX?: (x: StackedBarDatum<K>['x']) => string;
  formatY?: (y: number) => string; // used for axes/tooltip
  onPressBar?: (d: StackedBarDatum<K>) => void;
};

// Stub: render later with Skia/SVG; keep props stable now
export default function StackedBars<K extends string = string>(
  props: Props<K>,
) {
  const {
    data,
    legend,
    stacked = true, // eslint-disable-line @typescript-eslint/no-unused-vars
    normalize100 = false,
    sortSegments = 'none',
    barWidth = 12, // eslint-disable-line @typescript-eslint/no-unused-vars
    gap = 2, // eslint-disable-line @typescript-eslint/no-unused-vars
    formatX = x => String(x),
    formatY = y => y.toFixed(1),
    onPressBar, // eslint-disable-line @typescript-eslint/no-unused-vars
  } = props;

  const styles = useThemeStyles();
  const {translate} = useLocalize();

  // Precompute totals and normalized data
  const processedData = React.useMemo(() => {
    return data.map(datum => {
      const segmentEntries = Object.entries(datum.segments);
      const total = segmentEntries.reduce(
        (sum, [, value]) => sum + (Number(value) || 0),
        0,
      );

      // Sort segments if requested
      let sortedSegments = segmentEntries;
      if (sortSegments === 'asc') {
        sortedSegments = [...segmentEntries].sort(
          ([, a], [, b]) => (Number(a) || 0) - (Number(b) || 0),
        );
      } else if (sortSegments === 'desc') {
        sortedSegments = [...segmentEntries].sort(
          ([, a], [, b]) => (Number(b) || 0) - (Number(a) || 0),
        );
      }

      // Normalize to percentages if requested
      const normalizedSegments =
        normalize100 && total > 0
          ? Object.fromEntries(
              sortedSegments.map(([key, value]) => [
                key,
                ((Number(value) || 0) / total) * 100,
              ]),
            )
          : Object.fromEntries(sortedSegments);

      return {
        ...datum,
        segments: normalizedSegments,
        total,
        normalizedTotal: normalize100 ? 100 : total,
      };
    });
  }, [data, normalize100, sortSegments]);

  if (data.length === 0) {
    return (
      <View style={[styles.p4, styles.cardBG]}>
        <Text style={styles.textSupporting}>{translate('charts.noData')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.p4, styles.cardBG]}>
      {/* Legend */}
      <View style={[styles.flexRow, styles.flexWrap, styles.gap2, styles.mb2]}>
        {legend.map(item => (
          <View
            key={item.id}
            style={[styles.flexRow, styles.alignItemsCenter, styles.gap1]}>
            <View
              style={[
                styles.borderRadiusSmall,
                {
                  width: 12,
                  height: 12,
                  backgroundColor: item.color ?? styles.textSupporting.color,
                },
              ]}
            />
            <Text style={styles.textSupporting}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Data rows */}
      {processedData.map(datum => {
        const segmentEntries = Object.entries(datum.segments);
        const hasData = segmentEntries.some(
          ([, value]) => (Number(value) || 0) > 0,
        );

        return (
          <View key={String(datum.x)} style={styles.mb2}>
            <Text style={[styles.textHeadline, styles.mb1]}>
              {formatX(datum.x)}:
            </Text>

            {!hasData ? (
              <Text style={styles.textSupporting}>
                {translate('charts.noData')}
              </Text>
            ) : (
              <View style={[styles.flexRow, styles.flexWrap, styles.gap2]}>
                {segmentEntries.map(([key, value]) => {
                  const legendItem = legend.find(item => item.id === key);
                  const displayValue = Number(value) || 0;
                  const unit = normalize100 ? '%' : translate('charts.units');

                  return (
                    <Text key={key} style={styles.textSupporting}>
                      {legendItem?.label ?? key}: {formatY(displayValue)}
                      {unit}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export type {StackedBarDatum, LegendItem};
