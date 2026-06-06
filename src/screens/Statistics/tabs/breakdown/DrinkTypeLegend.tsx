import {View} from 'react-native';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {DRINK_KEY_COLORS, DRINK_KEY_LABEL} from '@libs/Statistics/drinkKeyMeta';
import type {DrinkKey} from '@src/types/onyx/Drinks';

type LegendEntry = {
  key: DrinkKey;
  /** Present only for the `breakdown` variant — drives the "x units (y%)" suffix. */
  units?: number;
  share?: number;
};

type DrinkTypeLegendProps = {
  /**
   * Keys to show, already filtered to what the chart actually plots and in
   * `DRINK_KEY_ORDER`. An empty array renders nothing.
   */
  entries: readonly LegendEntry[];
  /**
   * `breakdown` appends units + share to each label (donut); `trends` shows a
   * bare swatch + label (stacked area, where the series is over time).
   */
  variant: 'breakdown' | 'trends';
};

/**
 * Persistent color key for the drink-type charts. Dumb render component — the
 * parent computes `entries` from its own already-filtered data so the legend
 * always lists exactly the keys (and order) on screen.
 */
function DrinkTypeLegend({entries, variant}: DrinkTypeLegendProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  if (entries.length === 0) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel={translate('statistics.legend.drinkTypeA11y')}
      style={[
        styles.flexRow,
        styles.flexWrap,
        styles.justifyContentCenter,
        {columnGap: 14, rowGap: 6},
      ]}>
      {entries.map(({key, units, share}) => {
        const label =
          variant === 'breakdown' && units !== undefined && share !== undefined
            ? translate('statistics.tabs.breakdown.donut.sliceCaption', {
                label: translate(DRINK_KEY_LABEL[key]),
                units: Math.round(units * 10) / 10,
                share: Math.round(share * 100),
              })
            : translate(DRINK_KEY_LABEL[key]);
        return (
          <View
            key={key}
            style={[styles.flexRow, styles.alignItemsCenter, {columnGap: 6}]}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: DRINK_KEY_COLORS[key],
              }}
            />
            <Text style={[styles.textMicroSupporting]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

DrinkTypeLegend.displayName = 'DrinkTypeLegend';

export default DrinkTypeLegend;
export type {DrinkTypeLegendProps, LegendEntry};
