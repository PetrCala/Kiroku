/**
 * @jest-environment node
 */

import {
  getDrinkAbv,
  getDrinkCount,
  getDrinkOverrides,
  getDrinkVolumeMl,
  makeDrinkEntry,
} from '@libs/DrinkEntryUtils';
import CONST from '@src/CONST';

describe('getDrinkCount', () => {
  it('returns the numeric value for the legacy form', () => {
    expect(getDrinkCount(5)).toBe(5);
  });

  it('returns the count field for the object form', () => {
    expect(getDrinkCount({count: 5})).toBe(5);
    expect(getDrinkCount({count: 5, volume_ml: 600})).toBe(5);
    expect(getDrinkCount({count: 5, volume_ml: 600, abv: 0.06})).toBe(5);
  });

  it('returns 0 for undefined', () => {
    expect(getDrinkCount(undefined)).toBe(0);
  });

  it('returns 0 for the legacy zero', () => {
    expect(getDrinkCount(0)).toBe(0);
  });
});

describe('getDrinkVolumeMl', () => {
  it('falls back to CONST.DRINK_DEFAULTS for numeric entries', () => {
    expect(getDrinkVolumeMl('beer', 3)).toBe(CONST.DRINK_DEFAULTS.beer.ml);
    expect(getDrinkVolumeMl('wine', 1)).toBe(CONST.DRINK_DEFAULTS.wine.ml);
  });

  it('falls back to defaults when the object form omits volume_ml', () => {
    expect(getDrinkVolumeMl('beer', {count: 2})).toBe(
      CONST.DRINK_DEFAULTS.beer.ml,
    );
    expect(getDrinkVolumeMl('beer', {count: 2, abv: 0.04})).toBe(
      CONST.DRINK_DEFAULTS.beer.ml,
    );
  });

  it('returns the override when present', () => {
    expect(getDrinkVolumeMl('beer', {count: 1, volume_ml: 600})).toBe(600);
  });

  it('falls back to defaults for undefined entries', () => {
    expect(getDrinkVolumeMl('beer', undefined)).toBe(
      CONST.DRINK_DEFAULTS.beer.ml,
    );
  });
});

describe('getDrinkAbv', () => {
  it('falls back to CONST.DRINK_DEFAULTS for numeric entries', () => {
    expect(getDrinkAbv('beer', 3)).toBe(CONST.DRINK_DEFAULTS.beer.abv);
    expect(getDrinkAbv('wine', 1)).toBe(CONST.DRINK_DEFAULTS.wine.abv);
  });

  it('falls back to defaults when the object form omits abv', () => {
    expect(getDrinkAbv('beer', {count: 2})).toBe(CONST.DRINK_DEFAULTS.beer.abv);
    expect(getDrinkAbv('beer', {count: 2, volume_ml: 600})).toBe(
      CONST.DRINK_DEFAULTS.beer.abv,
    );
  });

  it('returns the override when present', () => {
    expect(getDrinkAbv('beer', {count: 1, abv: 0.07})).toBe(0.07);
  });
});

describe('makeDrinkEntry', () => {
  it('returns the bare number when no overrides are passed', () => {
    expect(makeDrinkEntry(3)).toBe(3);
  });

  it('returns the bare number when overrides object has no fields set', () => {
    expect(makeDrinkEntry(3, {})).toBe(3);
    expect(makeDrinkEntry(3, {volume_ml: undefined})).toBe(3);
  });

  it('returns the object form when volume_ml is set', () => {
    expect(makeDrinkEntry(3, {volume_ml: 600})).toEqual({
      count: 3,
      volume_ml: 600,
    });
  });

  it('returns the object form when abv is set', () => {
    expect(makeDrinkEntry(3, {abv: 0.07})).toEqual({count: 3, abv: 0.07});
  });

  it('returns the object form with both overrides', () => {
    expect(makeDrinkEntry(2, {volume_ml: 600, abv: 0.07})).toEqual({
      count: 2,
      volume_ml: 600,
      abv: 0.07,
    });
  });
});

describe('getDrinkOverrides', () => {
  it('returns undefined for numeric entries', () => {
    expect(getDrinkOverrides(5)).toBeUndefined();
  });

  it('returns undefined for the bare-count object form', () => {
    expect(getDrinkOverrides({count: 5})).toBeUndefined();
  });

  it('returns only the override fields that are set', () => {
    expect(getDrinkOverrides({count: 5, volume_ml: 600})).toEqual({
      volume_ml: 600,
    });
    expect(getDrinkOverrides({count: 5, abv: 0.07})).toEqual({abv: 0.07});
    expect(getDrinkOverrides({count: 5, volume_ml: 600, abv: 0.07})).toEqual({
      volume_ml: 600,
      abv: 0.07,
    });
  });
});
