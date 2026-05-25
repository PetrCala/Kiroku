import colors from '@styles/theme/colors';
import CONST from '@src/CONST';
import type {DrinkKey} from '@src/types/onyx/Drinks';

/**
 * Seven shades from the yellow→orange family — one per `DrinkKey`. Order
 * matches the chip-row order in `DrinkTypeChipRow` so the donut legend and
 * the toolbar chips read top-to-bottom the same way. Theme-independent on
 * purpose: the yellow→orange palette is the brand's stats palette, and
 * stays identical across light and dark themes (text and frame contrast
 * adapts around it).
 */
const DRINK_KEY_COLORS: Readonly<Record<DrinkKey, string>> = {
  [CONST.DRINKS.KEYS.SMALL_BEER]: colors.yellow300,
  [CONST.DRINKS.KEYS.BEER]: colors.yellow500,
  [CONST.DRINKS.KEYS.WINE]: colors.yellow600,
  [CONST.DRINKS.KEYS.WEAK_SHOT]: colors.orange300,
  [CONST.DRINKS.KEYS.STRONG_SHOT]: colors.orange500,
  [CONST.DRINKS.KEYS.COCKTAIL]: colors.orange700,
  [CONST.DRINKS.KEYS.OTHER]: colors.orange900,
};

const DRINK_KEY_ORDER: readonly DrinkKey[] = [
  CONST.DRINKS.KEYS.SMALL_BEER,
  CONST.DRINKS.KEYS.BEER,
  CONST.DRINKS.KEYS.WINE,
  CONST.DRINKS.KEYS.WEAK_SHOT,
  CONST.DRINKS.KEYS.STRONG_SHOT,
  CONST.DRINKS.KEYS.COCKTAIL,
  CONST.DRINKS.KEYS.OTHER,
];

function getDrinkKeyColor(key: DrinkKey): string {
  return DRINK_KEY_COLORS[key];
}

export {DRINK_KEY_COLORS, DRINK_KEY_ORDER, getDrinkKeyColor};
