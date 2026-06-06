import {useMemo} from 'react';
import {View} from 'react-native';
import {addWeeks, format, startOfISOWeek} from 'date-fns';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {COMPOSITE_KEY_SEP} from '@libs/Statistics';
import type {ChartDatum} from '@libs/Statistics';
import {
  DRINK_KEY_COLORS,
  DRINK_KEY_LABEL,
  DRINK_KEY_ORDER,
} from '@libs/Statistics/drinkKeyMeta';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import MiniLineChart from './MiniLineChart';

type PerTypeWeeklyMultiplesProps = {
  unitsByDrinkKeyAndWeek: ReadonlyMap<string, number>;
  drinkTypeFilter: ReadonlySet<DrinkKey>;
  rangeStart: Date;
  rangeEnd: Date;
  /**
   * Comparison-period per-type weekly units. When provided (Compare on), each
   * tile overlays a dashed line for the previous period, index-aligned to the
   * current series.
   */
  comparisonByDrinkKeyAndWeek?: ReadonlyMap<string, number>;
  comparisonStart?: Date;
  comparisonEnd?: Date;
  /** When true, renders a grid of placeholder tiles. */
  isLoading?: boolean;
};

/**
 * Align a comparison y-series to `targetLen` by position: drop the oldest
 * extras or pad leading zeros. Mirrors the Trends tab's overlay alignment so
 * the dashed line sits underneath the current line week-for-week.
 */
function alignToLength(values: number[], targetLen: number): number[] {
  if (values.length === targetLen) {
    return values;
  }
  if (values.length > targetLen) {
    return values.slice(values.length - targetLen);
  }
  return [...new Array<number>(targetLen - values.length).fill(0), ...values];
}

function isoWeekKey(d: Date): string {
  // Matches the `localIsoWeek` format produced by buildDrinkEvents (`yyyy-Www`).
  return format(d, "RRRR-'W'II");
}

function listWeekKeys(start: Date, end: Date): string[] {
  if (end < start) {
    return [];
  }
  const keys: string[] = [];
  let cursor = startOfISOWeek(start);
  while (cursor <= end) {
    keys.push(isoWeekKey(cursor));
    cursor = addWeeks(cursor, 1);
  }
  return keys;
}

function buildSeriesByDrinkKey(
  composite: ReadonlyMap<string, number>,
  weekKeys: string[],
): Map<DrinkKey, ChartDatum[]> {
  const series = new Map<DrinkKey, ChartDatum[]>();
  for (const key of DRINK_KEY_ORDER) {
    series.set(
      key,
      weekKeys.map(w => ({x: w, y: 0})),
    );
  }
  const weekIdx = new Map(weekKeys.map((k, i) => [k, i]));
  for (const [compositeKey, units] of composite.entries()) {
    const [drinkPart, weekPart] = compositeKey.split(COMPOSITE_KEY_SEP);
    const dk = drinkPart as DrinkKey;
    const idx = weekIdx.get(weekPart);
    const data = series.get(dk);
    if (idx === undefined || !data) {
      continue;
    }
    data[idx] = {x: weekPart, y: units};
  }
  return series;
}

function PerTypeWeeklyMultiples({
  unitsByDrinkKeyAndWeek,
  drinkTypeFilter,
  rangeStart,
  rangeEnd,
  comparisonByDrinkKeyAndWeek,
  comparisonStart,
  comparisonEnd,
  isLoading,
}: PerTypeWeeklyMultiplesProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {shouldUseNarrowLayout} = useResponsiveLayout();
  const columns = shouldUseNarrowLayout ? 2 : 3;
  const widthPercent = `${100 / columns}%` as const;

  const weekKeys = useMemo(
    () => listWeekKeys(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const seriesByKey = useMemo(
    () => buildSeriesByDrinkKey(unitsByDrinkKeyAndWeek, weekKeys),
    [unitsByDrinkKeyAndWeek, weekKeys],
  );

  const showComparison =
    !!comparisonByDrinkKeyAndWeek && !!comparisonStart && !!comparisonEnd;
  const comparisonSeriesByKey = useMemo(() => {
    if (!showComparison) {
      return null;
    }
    const cmpWeekKeys = listWeekKeys(comparisonStart, comparisonEnd);
    return buildSeriesByDrinkKey(comparisonByDrinkKeyAndWeek, cmpWeekKeys);
  }, [
    showComparison,
    comparisonByDrinkKeyAndWeek,
    comparisonStart,
    comparisonEnd,
  ]);

  if (isLoading) {
    return (
      <View style={[styles.flexRow, styles.flexWrap, {marginHorizontal: -4}]}>
        {Array.from({length: columns}, (_v, i) => (
          <View
            // eslint-disable-next-line react/no-array-index-key
            key={`tile-${i}`}
            style={{
              width: widthPercent,
              paddingHorizontal: 4,
              paddingVertical: 4,
            }}>
            <ChartSkeleton variant="card" height={120} />
          </View>
        ))}
      </View>
    );
  }

  const filter = drinkTypeFilter.size === 0 ? null : drinkTypeFilter;
  const tiles = DRINK_KEY_ORDER.flatMap(key => {
    if (filter && !filter.has(key)) {
      return [];
    }
    const data = seriesByKey.get(key) ?? [];
    const total = data.reduce((sum, d) => sum + d.y, 0);
    if (total === 0) {
      return [];
    }
    return [{key, data, total}];
  });

  if (tiles.length === 0) {
    return (
      <View style={[styles.alignItemsCenter, styles.p3]}>
        <Text style={[styles.textSupporting, styles.textAlignCenter]}>
          {translate('statistics.tabs.breakdown.multiples.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.flexRow, styles.flexWrap, {marginHorizontal: -4}]}>
      {tiles.map(({key, data, total}) => {
        const cmpSeries = comparisonSeriesByKey?.get(key);
        const comparison = cmpSeries
          ? alignToLength(
              cmpSeries.map(d => d.y),
              data.length,
            )
          : undefined;
        return (
          <View
            key={key}
            style={{
              width: widthPercent,
              paddingHorizontal: 4,
              paddingVertical: 4,
            }}>
            <MiniLineChart
              title={translate(DRINK_KEY_LABEL[key])}
              caption={translate(
                'statistics.tabs.breakdown.multiples.tileSubtitle',
                {units: Math.round(total * 10) / 10},
              )}
              data={data}
              comparison={comparison}
              accessibilityLabel={translate(
                'statistics.tabs.breakdown.multiples.a11yTile',
                {label: translate(DRINK_KEY_LABEL[key])},
              )}
              strokeColor={DRINK_KEY_COLORS[key]}
            />
          </View>
        );
      })}
    </View>
  );
}

PerTypeWeeklyMultiples.displayName = 'PerTypeWeeklyMultiples';

export default PerTypeWeeklyMultiples;
export type {PerTypeWeeklyMultiplesProps};
