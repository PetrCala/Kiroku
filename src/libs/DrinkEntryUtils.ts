import CONST from '@src/CONST';
import type {DrinkEntry, DrinkKey} from '@src/types/onyx/Drinks';

type DrinkOverrides = {volume_ml?: number; abv?: number};

/**
 * Pulls the count out of a `DrinkEntry`, accepting the legacy numeric form,
 * the object form, and `undefined` (returns 0). Use this at every read site
 * that previously did `drinks[key] ?? 0`.
 */
function getDrinkCount(entry: DrinkEntry | undefined): number {
  if (entry === undefined) {
    return 0;
  }
  if (typeof entry === 'number') {
    return entry;
  }
  return entry.count;
}

/**
 * Returns the per-event `volume_ml` if the entry carries one, otherwise the
 * default for that drink key from `CONST.DRINK_DEFAULTS`.
 */
function getDrinkVolumeMl(
  key: DrinkKey,
  entry: DrinkEntry | undefined,
): number {
  if (typeof entry === 'object' && entry?.volume_ml !== undefined) {
    return entry.volume_ml;
  }
  return CONST.DRINK_DEFAULTS[key].ml;
}

/**
 * Returns the per-event `abv` if the entry carries one, otherwise the default
 * for that drink key from `CONST.DRINK_DEFAULTS`. ABV is a fractional value
 * (e.g. 0.05 for 5%).
 */
function getDrinkAbv(key: DrinkKey, entry: DrinkEntry | undefined): number {
  if (typeof entry === 'object' && entry?.abv !== undefined) {
    return entry.abv;
  }
  return CONST.DRINK_DEFAULTS[key].abv;
}

/**
 * Returns the overrides carried by an entry, or undefined for the legacy
 * numeric form. Used to preserve a slot's existing `volume_ml`/`abv` when only
 * the count is changing (add / remove a drink).
 */
function getDrinkOverrides(
  entry: DrinkEntry | undefined,
): DrinkOverrides | undefined {
  if (entry === undefined || typeof entry === 'number') {
    return undefined;
  }
  const overrides: DrinkOverrides = {};
  if (entry.volume_ml !== undefined) {
    overrides.volume_ml = entry.volume_ml;
  }
  if (entry.abv !== undefined) {
    overrides.abv = entry.abv;
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/**
 * Builds a `DrinkEntry`. Returns the bare number when there are no overrides
 * so Onyx storage stays compact for the common case; only widens to the
 * object form when at least one of `volume_ml` / `abv` is set.
 */
function makeDrinkEntry(count: number, overrides?: DrinkOverrides): DrinkEntry {
  if (
    overrides === undefined ||
    (overrides.volume_ml === undefined && overrides.abv === undefined)
  ) {
    return count;
  }
  const entry: {count: number; volume_ml?: number; abv?: number} = {count};
  if (overrides.volume_ml !== undefined) {
    entry.volume_ml = overrides.volume_ml;
  }
  if (overrides.abv !== undefined) {
    entry.abv = overrides.abv;
  }
  return entry;
}

export {
  getDrinkAbv,
  getDrinkCount,
  getDrinkOverrides,
  getDrinkVolumeMl,
  makeDrinkEntry,
};
export type {DrinkOverrides};
