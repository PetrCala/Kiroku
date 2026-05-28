import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';
import {getDrinkAbv, getDrinkCount, getDrinkVolumeMl} from './DrinkEntryUtils';
import {isDrinkTypeKey} from './DrinkingSessionUtils';
import {roundToTwoDecimalPlaces} from './NumberUtils';

/** Density of pure ethanol in g/ml. */
const ETHANOL_DENSITY = 0.789;

/** Alcohol elimination rate in BAC percent per hour (zero-order Widmark). */
const ELIMINATION_RATE = 0.015;

/** Widmark distribution factor (r) per gender. `other`/unknown uses the male-female average. */
const WIDMARK_FACTOR_MALE = 0.68;
const WIDMARK_FACTOR_FEMALE = 0.55;
const WIDMARK_FACTOR_OTHER = 0.615;

const MS_PER_HOUR = 60 * 60 * 1000;

/** Sum the grams of pure ethanol across every drink event in a session. */
function getTotalEthanolGrams(session: DrinkingSession | undefined): number {
  const drinks = session?.drinks;
  if (!drinks) {
    return 0;
  }

  let grams = 0;
  Object.values(drinks).forEach(drinksAtTimestamp => {
    Object.keys(drinksAtTimestamp).forEach(key => {
      if (!isDrinkTypeKey(key)) {
        return;
      }
      const entry = drinksAtTimestamp[key];
      const count = getDrinkCount(entry);
      if (count <= 0) {
        return;
      }
      grams +=
        getDrinkVolumeMl(key, entry) *
        getDrinkAbv(key, entry) *
        ETHANOL_DENSITY *
        count;
    });
  });

  return grams;
}

/** Earliest drink-event timestamp (ms) in a session, or undefined when there are none. */
function getFirstDrinkTimestamp(
  session: DrinkingSession | undefined,
): number | undefined {
  const drinks = session?.drinks;
  if (!drinks) {
    return undefined;
  }

  const timestamps = Object.keys(drinks)
    .map(Number)
    .filter(timestamp => !Number.isNaN(timestamp));

  return timestamps.length > 0 ? Math.min(...timestamps) : undefined;
}

/** Widmark distribution factor for a gender string, defaulting to the averaged factor. */
function getWidmarkFactor(gender: string | undefined): number {
  if (gender === CONST.GENDER.MALE) {
    return WIDMARK_FACTOR_MALE;
  }
  if (gender === CONST.GENDER.FEMALE) {
    return WIDMARK_FACTOR_FEMALE;
  }
  return WIDMARK_FACTOR_OTHER;
}

/**
 * Current estimated BAC (g/100ml, i.e. percent) for a session, decayed to `now`
 * via the Widmark formula. Returns 0 when inputs are missing or the estimate
 * has decayed below zero.
 */
function estimateBacPercent(
  session: DrinkingSession | undefined,
  weightKg: number | undefined,
  gender: string | undefined,
  now: number = Date.now(),
): number {
  if (!weightKg || weightKg <= 0) {
    return 0;
  }

  const grams = getTotalEthanolGrams(session);
  if (grams <= 0) {
    return 0;
  }

  const firstDrinkTimestamp = getFirstDrinkTimestamp(session);
  if (firstDrinkTimestamp === undefined) {
    return 0;
  }

  const r = getWidmarkFactor(gender);
  const hours = Math.max(0, (now - firstDrinkTimestamp) / MS_PER_HOUR);
  const bac = grams / (weightKg * r * 10) - ELIMINATION_RATE * hours;

  return roundToTwoDecimalPlaces(Math.max(0, bac));
}

export {
  estimateBacPercent,
  getFirstDrinkTimestamp,
  getTotalEthanolGrams,
  getWidmarkFactor,
};
