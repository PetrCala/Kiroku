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
import type {TranslationPaths} from '@src/languages/types';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import {DRINK_KEY_COLORS, DRINK_KEY_ORDER} from './drinkKeyColors';
import MiniLineChart from './MiniLineChart';

const DRINK_LABEL_KEY: Readonly<Record<DrinkKey, TranslationPaths>> = {
  small_beer: 'drinks.smallBeer',
  beer: 'drinks.beer',
  wine: 'drinks.wine',
  weak_shot: 'drinks.weakShot',
  strong_shot: 'drinks.strongShot',
  cocktail: 'drinks.cocktail',
  other: 'drinks.other',
};

type PerTypeWeeklyMultiplesProps = {
  unitsByDrinkKeyAndWeek: ReadonlyMap<string, number>;
  drinkTypeFilter: ReadonlySet<DrinkKey>;
  rangeStart: Date;
  rangeEnd: Date;
  /** When true, renders a grid of placeholder tiles. */
  isLoading?: boolean;
};

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
      {tiles.map(({key, data, total}) => (
        <View
          key={key}
          style={{
            width: widthPercent,
            paddingHorizontal: 4,
            paddingVertical: 4,
          }}>
          <MiniLineChart
            title={translate(DRINK_LABEL_KEY[key])}
            caption={translate(
              'statistics.tabs.breakdown.multiples.tileSubtitle',
              {units: Math.round(total * 10) / 10},
            )}
            data={data}
            accessibilityLabel={translate(
              'statistics.tabs.breakdown.multiples.a11yTile',
              {label: translate(DRINK_LABEL_KEY[key])},
            )}
            strokeColor={DRINK_KEY_COLORS[key]}
          />
        </View>
      ))}
    </View>
  );
}

PerTypeWeeklyMultiples.displayName = 'PerTypeWeeklyMultiples';

export default PerTypeWeeklyMultiples;
export type {PerTypeWeeklyMultiplesProps};
