import colors from '@styles/theme/colors';
import CONST from '@src/CONST';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {TranslationPaths} from '@src/languages/types';

/**
 * The drink-type categorical palettes. Each maps every `DrinkKey` to a named
 * color token from `@styles/theme/colors` (the sanctioned home for color
 * literals). `vivid` is the active palette; `trueToGlass` is a naturalistic
 * alternative kept ready for a future switch. Theme-independent on purpose —
 * these are domain colors, identical in light and dark.
 */
const DRINK_PALETTES: Record<
  'vivid' | 'trueToGlass',
  Readonly<Record<DrinkKey, string>>
> = {
  // "Vivid & distinct" — bright, maximally distinguishable.
  vivid: {
    [CONST.DRINKS.KEYS.SMALL_BEER]: colors.gold,
    [CONST.DRINKS.KEYS.BEER]: colors.amber500,
    [CONST.DRINKS.KEYS.WINE]: colors.burgundy,
    [CONST.DRINKS.KEYS.WEAK_SHOT]: colors.emerald400,
    [CONST.DRINKS.KEYS.STRONG_SHOT]: colors.chestnut,
    [CONST.DRINKS.KEYS.COCKTAIL]: colors.magenta,
    [CONST.DRINKS.KEYS.OTHER]: colors.indigo400,
  },
  // "True to glass" — naturalistic, each hue closer to the real drink.
  trueToGlass: {
    [CONST.DRINKS.KEYS.SMALL_BEER]: colors.straw,
    [CONST.DRINKS.KEYS.BEER]: colors.ochre,
    [CONST.DRINKS.KEYS.WINE]: colors.maroon,
    [CONST.DRINKS.KEYS.WEAK_SHOT]: colors.sage,
    [CONST.DRINKS.KEYS.STRONG_SHOT]: colors.cocoa,
    [CONST.DRINKS.KEYS.COCKTAIL]: colors.coral,
    [CONST.DRINKS.KEYS.OTHER]: colors.mauve,
  },
};

// Single switch point for the drink-type palette. Flip to `'trueToGlass'` to
// swap the whole app over. A future centralized design-toggle system (akin to
// feature flags) could drive this selection.
const ACTIVE_DRINK_PALETTE: keyof typeof DRINK_PALETTES = 'vivid';

/**
 * One color per `DrinkKey` — the single source of truth for drink-type color
 * across Statistics (Breakdown donut + per-type multiples, Trends "drink mix
 * over time" stack, and their legends), resolved from the active palette.
 */
const DRINK_KEY_COLORS: Readonly<Record<DrinkKey, string>> =
  DRINK_PALETTES[ACTIVE_DRINK_PALETTE];

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
