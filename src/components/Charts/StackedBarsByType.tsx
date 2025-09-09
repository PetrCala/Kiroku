import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import type {StackedPoint} from '@analytics/types';
import type {DrinkKey} from '@src/types/onyx';
import CONST from '@src/CONST';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import type {TranslationPaths} from '@src/languages/types';

type LegendItem = {id: DrinkKey; label: string};

type Props = {
  data: StackedPoint[];
  legend: LegendItem[];
};

function StackedBarsByType({data, legend}: Props) {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const drinkKeys = Object.values(CONST.DRINKS.KEYS);

  // This might be abstracted to a helper function
  const getDrinkTranslationKey = (drinkKey: DrinkKey): string => {
    const keyMap: Record<DrinkKey, string> = {
      [CONST.DRINKS.KEYS.SMALL_BEER]: 'common.drinks.smallBeer',
      [CONST.DRINKS.KEYS.BEER]: 'common.drinks.beer',
      [CONST.DRINKS.KEYS.COCKTAIL]: 'common.drinks.cocktail',
      [CONST.DRINKS.KEYS.OTHER]: 'common.drinks.other',
      [CONST.DRINKS.KEYS.STRONG_SHOT]: 'common.drinks.strongShot',
      [CONST.DRINKS.KEYS.WEAK_SHOT]: 'common.drinks.weakShot',
      [CONST.DRINKS.KEYS.WINE]: 'common.drinks.wine',
    };
    return keyMap[drinkKey];
  };

  return (
    <View style={[styles.p4, styles.cardBG]}>
      <View style={[styles.flexRow, styles.gap2, styles.mb2]}>
        {legend.map(l => (
          <Text key={l.id} style={styles.textSupporting}>
            {l.label}
          </Text>
        ))}
      </View>
      {data.length === 0 ? (
        <Text style={styles.textSupporting}>
          {translate('charts.noData' as TranslationPaths)}
        </Text>
      ) : (
        data.map(row => (
          <View key={row.x} style={[styles.mb2]}>
            <Text style={[styles.textHeadline, styles.mb1]}>{row.x}:</Text>
            <View style={[styles.flexRow, styles.flexWrap, styles.gap2]}>
              {drinkKeys.map(drinkKey => {
                const value = row.segments[drinkKey] ?? 0;
                const translationKey = getDrinkTranslationKey(drinkKey);
                const drinkName = translate(translationKey as TranslationPaths);

                return (
                  <Text key={drinkKey} style={styles.textSupporting}>
                    {drinkName} {value}{' '}
                    {translate('charts.units' as TranslationPaths)}
                  </Text>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export default StackedBarsByType;
