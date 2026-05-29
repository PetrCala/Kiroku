import {View} from 'react-native';
import Icon from '@components/Icon';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import DrinkData from '@libs/DrinkData';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type IconAsset from '@src/types/utils/IconAsset';

type DrinkBreakdownItem = {
  drinkKey: DrinkKey;
  units: number;
};

type DrinkBreakdownProps = {
  /** Already ordered and filtered to drink types with units > 0. */
  items: DrinkBreakdownItem[];
  accessibilityLabel: string;
  isLoading?: boolean;
};

const ICON_BY_DRINK_KEY = DrinkData.reduce<
  Partial<Record<DrinkKey, IconAsset>>
>((acc, entry) => {
  acc[entry.key] = entry.icon;
  return acc;
}, {});

const ROW_HEIGHT = 34;

function formatUnits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Composition row for a period's units — one chip per drink type the user
 * actually logged (icon + total units), ordered by the shared drink-key
 * order. Drink types with zero units are omitted by the caller, so the row
 * only shows what's relevant.
 */
function DrinkBreakdown({
  items,
  accessibilityLabel,
  isLoading,
}: DrinkBreakdownProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();

  if (isLoading) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={{height: ROW_HEIGHT}}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.flexRow, styles.flexWrap]}>
      {items.map(item => {
        const icon = ICON_BY_DRINK_KEY[item.drinkKey];
        const name = translate(findDrinkNameTranslationKey(item.drinkKey));
        return (
          <View
            key={item.drinkKey}
            accessibilityLabel={`${name}: ${formatUnits(item.units)}`}
            style={[
              styles.flexRow,
              styles.alignItemsCenter,
              styles.mr1,
              styles.mt1,
              {
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: theme.appBG,
              },
            ]}>
            {icon ? (
              <Icon src={icon} width={16} height={16} fill={theme.icon} />
            ) : null}
            <Text style={[styles.textMicro, styles.textStrong, styles.ml1]}>
              {formatUnits(item.units)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default DrinkBreakdown;
export type {DrinkBreakdownItem, DrinkBreakdownProps};
