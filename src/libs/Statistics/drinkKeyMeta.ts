import {drinkTypeColors} from '@styles/theme/colors';
import CONST from '@src/CONST';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {TranslationPaths} from '@src/languages/types';

/**
 * One color per `DrinkKey` — the single source of truth for drink-type color
 * across Statistics (Breakdown donut + per-type multiples, Trends "drink mix
 * over time" stack, and their legends). The hex values live in
 * `@styles/theme/colors` as `drinkTypeColors` (the sanctioned home for color
 * literals); this map keys them by the typed `DrinkKey` enum so the charts get
 * a complete, type-checked record.
 */
const DRINK_KEY_COLORS: Readonly<Record<DrinkKey, string>> = {
  [CONST.DRINKS.KEYS.SMALL_BEER]: drinkTypeColors.small_beer,
  [CONST.DRINKS.KEYS.BEER]: drinkTypeColors.beer,
  [CONST.DRINKS.KEYS.WINE]: drinkTypeColors.wine,
  [CONST.DRINKS.KEYS.WEAK_SHOT]: drinkTypeColors.weak_shot,
  [CONST.DRINKS.KEYS.STRONG_SHOT]: drinkTypeColors.strong_shot,
  [CONST.DRINKS.KEYS.COCKTAIL]: drinkTypeColors.cocktail,
  [CONST.DRINKS.KEYS.OTHER]: drinkTypeColors.other,
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

/** Translation path for each drink type's display name. Shared so the donut, */
/** multiples, drill-down titles, filter chips, and legend never drift. */
const DRINK_KEY_LABEL: Readonly<Record<DrinkKey, TranslationPaths>> = {
  [CONST.DRINKS.KEYS.SMALL_BEER]: 'drinks.smallBeer',
  [CONST.DRINKS.KEYS.BEER]: 'drinks.beer',
  [CONST.DRINKS.KEYS.WINE]: 'drinks.wine',
  [CONST.DRINKS.KEYS.WEAK_SHOT]: 'drinks.weakShot',
  [CONST.DRINKS.KEYS.STRONG_SHOT]: 'drinks.strongShot',
  [CONST.DRINKS.KEYS.COCKTAIL]: 'drinks.cocktail',
  [CONST.DRINKS.KEYS.OTHER]: 'drinks.other',
};

type DrinkShare = {key: DrinkKey; units: number; share: number};

/**
 * Reduce a units-by-drink map into ordered shares — the keys actually plotted
 * (in `DRINK_KEY_ORDER`), filtered to the active chip selection and to keys
 * with non-zero units. Shared by the donut (which layers slice angles on top)
 * and the legend, so both list exactly the same keys in the same order.
 *
 * An empty `drinkTypeFilter` means "all keys".
 */
function computeDrinkShares(
  unitsByDrinkKey: ReadonlyMap<DrinkKey, number>,
  drinkTypeFilter: ReadonlySet<DrinkKey>,
): {entries: DrinkShare[]; total: number} {
  const filter = drinkTypeFilter.size === 0 ? null : drinkTypeFilter;
  let total = 0;
  const present: Array<{key: DrinkKey; units: number}> = [];
  for (const key of DRINK_KEY_ORDER) {
    if (filter && !filter.has(key)) {
      continue;
    }
    const units = unitsByDrinkKey.get(key) ?? 0;
    if (units > 0) {
      present.push({key, units});
      total += units;
    }
  }
  if (total === 0) {
    return {entries: [], total: 0};
  }
  const entries = present.map(({key, units}) => ({
    key,
    units,
    share: units / total,
  }));
  return {entries, total};
}

function getDrinkKeyColor(key: DrinkKey): string {
  return DRINK_KEY_COLORS[key];
}

export {
  DRINK_KEY_COLORS,
  DRINK_KEY_ORDER,
  DRINK_KEY_LABEL,
  computeDrinkShares,
  getDrinkKeyColor,
};
export type {DrinkShare};
