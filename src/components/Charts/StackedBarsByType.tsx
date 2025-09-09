import React from 'react';
import type {DrinkKey} from '@src/types/onyx';
import CONST from '@src/CONST';
import useLocalize from '@hooks/useLocalize';
import type {TranslationPaths} from '@src/languages/types';
import type {StackedBarDatum, LegendItem} from './StackedBars';
import StackedBars from './StackedBars';

type Props = {
  data: Array<StackedBarDatum<DrinkKey>>; // same shape as generic
};

function StackedBarsByType({data}: Props) {
  const {translate} = useLocalize();

  // Convert legend items to use translated labels
  const translatedLegend: Array<LegendItem<DrinkKey>> = React.useMemo(() => {
    const getDrinkTranslationKey = (drinkKey: DrinkKey): TranslationPaths => {
      const keyMap: Record<DrinkKey, TranslationPaths> = {
        [CONST.DRINKS.KEYS.SMALL_BEER]: 'drinks.smallBeer',
        [CONST.DRINKS.KEYS.BEER]: 'drinks.beer',
        [CONST.DRINKS.KEYS.COCKTAIL]: 'drinks.cocktail',
        [CONST.DRINKS.KEYS.OTHER]: 'drinks.other',
        [CONST.DRINKS.KEYS.STRONG_SHOT]: 'drinks.strongShot',
        [CONST.DRINKS.KEYS.WEAK_SHOT]: 'drinks.weakShot',
        [CONST.DRINKS.KEYS.WINE]: 'drinks.wine',
      };
      return keyMap[drinkKey];
    };

    return Object.values(CONST.DRINKS.KEYS).map(item => ({
      id: item,
      label: translate(getDrinkTranslationKey(item)),
    }));
  }, [translate]);

  return (
    <StackedBars<DrinkKey>
      data={data}
      legend={translatedLegend}
      stacked
      normalize100={false}
      formatX={x => String(x)}
      formatY={y => y.toFixed(1)}
    />
  );
}

export default StackedBarsByType;
