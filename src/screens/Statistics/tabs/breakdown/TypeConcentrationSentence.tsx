import {useMemo} from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {compareConcentration, computeHhi} from '@libs/Statistics/herfindahl';
import type {ConcentrationVerdict} from '@libs/Statistics/herfindahl';
import type {RangePreset} from '@src/types/onyx/StatisticsFilters';
import type {DrinkKey} from '@src/types/onyx/Drinks';

function renderVerdict(
  translate: ReturnType<typeof useLocalize>['translate'],
  verdict: ConcentrationVerdict,
  period: string,
): string {
  switch (verdict) {
    case 'moreVaried':
      return translate('statistics.tabs.breakdown.concentration.moreVaried', {
        period,
      });
    case 'moreFocused':
      return translate('statistics.tabs.breakdown.concentration.moreFocused', {
        period,
      });
    case 'aboutTheSame':
    default:
      return translate('statistics.tabs.breakdown.concentration.aboutTheSame', {
        period,
      });
  }
}

function renderPeriod(
  translate: ReturnType<typeof useLocalize>['translate'],
  preset: RangePreset,
): string {
  switch (preset) {
    case 'W':
      return translate('statistics.tabs.breakdown.concentration.period.week');
    case 'M':
      return translate('statistics.tabs.breakdown.concentration.period.month');
    case '6M':
      return translate(
        'statistics.tabs.breakdown.concentration.period.sixMonths',
      );
    case 'Y':
      return translate('statistics.tabs.breakdown.concentration.period.year');
    case 'All':
    case 'Custom':
    default:
      return translate('statistics.tabs.breakdown.concentration.period.window');
  }
}

type TypeConcentrationSentenceProps = {
  /** All-key units in the current window (filter-independent). */
  currentUnitsByDrinkKey: ReadonlyMap<DrinkKey, number>;
  /** All-key units in the equal-duration window immediately before. */
  priorUnitsByDrinkKey: ReadonlyMap<DrinkKey, number>;
  preset: RangePreset;
};

function sumValues(map: ReadonlyMap<DrinkKey, number>): number {
  let total = 0;
  for (const v of map.values()) {
    if (v > 0) {
      total += v;
    }
  }
  return total;
}

function TypeConcentrationSentence({
  currentUnitsByDrinkKey,
  priorUnitsByDrinkKey,
  preset,
}: TypeConcentrationSentenceProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const verdict = useMemo<ConcentrationVerdict | null>(() => {
    if (sumValues(currentUnitsByDrinkKey) === 0) {
      // No honest claim possible when the current window is empty.
      return null;
    }
    const currentHhi = computeHhi(currentUnitsByDrinkKey);
    const priorHhi = computeHhi(priorUnitsByDrinkKey);
    return compareConcentration(currentHhi, priorHhi);
  }, [currentUnitsByDrinkKey, priorUnitsByDrinkKey]);

  if (verdict === null) {
    return null;
  }

  const period = renderPeriod(translate, preset);
  return (
    <View style={[styles.p3]}>
      <Text style={[styles.textSupporting]}>
        {renderVerdict(translate, verdict, period)}
      </Text>
    </View>
  );
}

TypeConcentrationSentence.displayName = 'TypeConcentrationSentence';

export default TypeConcentrationSentence;
export type {TypeConcentrationSentenceProps};
