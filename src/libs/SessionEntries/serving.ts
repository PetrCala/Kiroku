import CONST from '@src/CONST';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {SessionEntry} from '@src/types/onyx/SessionEntries';

/** One serving the capture UI offers: a volume and a strength. */
type DrinkServing = {
  /** Volume in millilitres */
  ml: number;

  /** ABV as a fraction (0..1), the shape the entry stores */
  abv: number;
};

/**
 * The servings offered for a drink type, the first one its default. Falls back
 * to the single default serving for a key with no preset list, so a new drink
 * type cannot break the picker.
 */
function getDrinkServings(drinkKey: DrinkKey): DrinkServing[] {
  const presets = CONST.DRINK_PRESETS[drinkKey];
  if (presets && presets.length > 0) {
    return [...presets];
  }
  const fallback = CONST.DRINK_DEFAULTS[drinkKey];
  return fallback ? [{ml: fallback.ml, abv: fallback.abv}] : [];
}

/** The serving a drink type assumes when an entry names none (RFC §4.3). */
function getDefaultServing(drinkKey: DrinkKey): DrinkServing | undefined {
  const fallback = CONST.DRINK_DEFAULTS[drinkKey];
  return fallback ? {ml: fallback.ml, abv: fallback.abv} : undefined;
}

/**
 * The serving an entry stands for: what it names, else its type's default.
 * `undefined` only when the type has no default either.
 */
function getEntryServing(
  entry: Pick<SessionEntry, 'key' | 'volume_ml' | 'abv'>,
): DrinkServing | undefined {
  const defaults = getDefaultServing(entry.key);
  const ml = entry.volume_ml ?? defaults?.ml;
  const abv = entry.abv ?? defaults?.abv;
  return ml === undefined || abv === undefined ? undefined : {ml, abv};
}

/**
 * Whether an entry names its own serving rather than leaning on the default.
 * The timeline shows the serving only when it does, so a row stays quiet for
 * the ordinary case and speaks up for the 0.5 l 7% IPA.
 */
function hasCustomServing(
  entry: Pick<SessionEntry, 'key' | 'volume_ml' | 'abv'>,
): boolean {
  const defaults = getDefaultServing(entry.key);
  return (
    (entry.volume_ml !== undefined && entry.volume_ml !== defaults?.ml) ||
    (entry.abv !== undefined && entry.abv !== defaults?.abv)
  );
}

/** Whether two servings are the same volume and strength. */
function isSameServing(a: DrinkServing, b: DrinkServing): boolean {
  return a.ml === b.ml && a.abv === b.abv;
}

export {
  getDefaultServing,
  getDrinkServings,
  getEntryServing,
  hasCustomServing,
  isSameServing,
};
export type {DrinkServing};
