/**
 * The serving helpers behind the capture UI's preset picker
 * (`@libs/SessionEntries/serving`) and the time-of-day field's input clamp.
 *
 * The rule these encode: an entry stores a serving only when the user chose
 * one, and a reader falls back to `CONST.DRINK_DEFAULTS` otherwise (RFC §4.3).
 * So "does this entry name its own serving?" is a different question from
 * "what serving is this entry", and the timeline needs both.
 */
import {
  getDefaultServing,
  getDrinkServings,
  getEntryServing,
  hasCustomServing,
  isSameServing,
} from '@libs/SessionEntries';
import {
  clampTimeField,
  getTimeOfDay,
  withTimeOfDay,
} from '@libs/TimeOfDayUtils';
import CONST from '@src/CONST';

describe('getDrinkServings', () => {
  it('offers the type default first', () => {
    const servings = getDrinkServings('beer');
    expect(servings.at(0)).toEqual({
      ml: CONST.DRINK_DEFAULTS.beer.ml,
      abv: CONST.DRINK_DEFAULTS.beer.abv,
    });
  });

  it('offers a short list for every drink type the app knows', () => {
    for (const key of Object.values(CONST.DRINKS.KEYS)) {
      const servings = getDrinkServings(key);
      expect(servings.length).toBeGreaterThan(0);
      // Short on purpose: these are the servings people order, not a
      // catalogue. Anything else goes in through the per-entry edit.
      expect(servings.length).toBeLessThanOrEqual(6);
      for (const serving of servings) {
        expect(serving.ml).toBeGreaterThan(0);
        expect(serving.abv).toBeGreaterThan(0);
        expect(serving.abv).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never hands back the same list object twice', () => {
    // The picker sorts and unshifts into what it gets; a shared array would
    // let one screen mutate `CONST`.
    const first = getDrinkServings('beer');
    first.push({ml: 1, abv: 0.99});
    expect(getDrinkServings('beer')).not.toContainEqual({ml: 1, abv: 0.99});
  });
});

describe('getEntryServing', () => {
  const entry = (overrides: Record<string, unknown> = {}) =>
    ({key: 'beer', ...overrides}) as Parameters<typeof getEntryServing>[0];

  it('prefers what the entry names', () => {
    expect(getEntryServing(entry({volume_ml: 400, abv: 0.07}))).toEqual({
      ml: 400,
      abv: 0.07,
    });
  });

  it('falls back to the type default for each field separately', () => {
    expect(getEntryServing(entry({abv: 0.07}))).toEqual({
      ml: CONST.DRINK_DEFAULTS.beer.ml,
      abv: 0.07,
    });
    expect(getEntryServing(entry({volume_ml: 400}))).toEqual({
      ml: 400,
      abv: CONST.DRINK_DEFAULTS.beer.abv,
    });
  });

  it('is the type default for an entry that names nothing', () => {
    expect(getEntryServing(entry())).toEqual(getDefaultServing('beer'));
  });
});

describe('hasCustomServing', () => {
  const entry = (overrides: Record<string, unknown> = {}) =>
    ({key: 'beer', ...overrides}) as Parameters<typeof hasCustomServing>[0];

  it('is false for an entry that names nothing', () => {
    expect(hasCustomServing(entry())).toBe(false);
  });

  it('is false for an entry that names exactly the default', () => {
    // A backfilled or watch-written entry may carry the defaults explicitly.
    // Showing "500 ml, 5%" on every beer row would be noise.
    expect(
      hasCustomServing(
        entry({
          volume_ml: CONST.DRINK_DEFAULTS.beer.ml,
          abv: CONST.DRINK_DEFAULTS.beer.abv,
        }),
      ),
    ).toBe(false);
  });

  it('is true as soon as either field differs', () => {
    expect(hasCustomServing(entry({volume_ml: 400}))).toBe(true);
    expect(hasCustomServing(entry({abv: 0.07}))).toBe(true);
  });
});

describe('isSameServing', () => {
  it('compares both fields', () => {
    expect(isSameServing({ml: 500, abv: 0.05}, {ml: 500, abv: 0.05})).toBe(
      true,
    );
    expect(isSameServing({ml: 500, abv: 0.05}, {ml: 500, abv: 0.07})).toBe(
      false,
    );
    expect(isSameServing({ml: 500, abv: 0.05}, {ml: 400, abv: 0.05})).toBe(
      false,
    );
  });
});

describe('clampTimeField', () => {
  it('keeps a value inside the field range', () => {
    expect(clampTimeField('9', 23)).toBe(9);
    expect(clampTimeField('23', 23)).toBe(23);
    expect(clampTimeField('99', 23)).toBe(23);
    expect(clampTimeField('59', 59)).toBe(59);
    expect(clampTimeField('60', 59)).toBe(59);
  });

  it('reads an empty or non-numeric field as zero rather than NaN', () => {
    // A NaN would reach `setHours` and make the whole timestamp invalid,
    // which the user would see as a session that jumped to 1970.
    expect(clampTimeField('', 23)).toBe(0);
    expect(clampTimeField('ab', 23)).toBe(0);
    expect(clampTimeField('-', 59)).toBe(0);
  });

  it('strips separators a keyboard may insert and keeps two digits', () => {
    expect(clampTimeField('1:5', 23)).toBe(15);
    expect(clampTimeField('0745', 23)).toBe(7);
  });
});

describe('the time-of-day round trip', () => {
  // 2023-11-14 22:00 UTC, which is 2023-11-14 23:00 in Prague and
  // 2023-11-15 07:00 in Tokyo: the same instant on two different local days.
  const INSTANT = Date.UTC(2023, 10, 14, 22, 0, 0);

  it('reads the wall clock of the given timezone, not the device', () => {
    expect(getTimeOfDay(INSTANT, 'Europe/Prague')).toEqual({
      hours: 23,
      minutes: 0,
    });
    expect(getTimeOfDay(INSTANT, 'Asia/Tokyo')).toEqual({
      hours: 7,
      minutes: 0,
    });
  });

  it('sets the wall clock in that timezone and inverts cleanly', () => {
    const moved = withTimeOfDay(INSTANT, 'Europe/Prague', 21, 30);
    expect(getTimeOfDay(moved, 'Europe/Prague')).toEqual({
      hours: 21,
      minutes: 30,
    });
  });

  it('keeps the calendar day the value already falls on in that timezone', () => {
    // In Tokyo the instant is the 15th at 07:00. Moving it to 09:00 must stay
    // on the 15th in Tokyo, not jump to the 14th because UTC says so.
    const moved = withTimeOfDay(INSTANT, 'Asia/Tokyo', 9, 0);
    expect(
      new Date(moved).toLocaleDateString('en-CA', {timeZone: 'Asia/Tokyo'}),
    ).toBe('2023-11-15');
  });

  it('clears seconds so the stored time is exactly what was typed', () => {
    const withSeconds = INSTANT + 37_000 + 400;
    const moved = withTimeOfDay(withSeconds, 'Europe/Prague', 20, 15);
    const asDate = new Date(moved);
    expect(asDate.getSeconds()).toBe(0);
    expect(asDate.getMilliseconds()).toBe(0);
  });

  it('is a no-op when the same wall clock is set again', () => {
    const {hours, minutes} = getTimeOfDay(INSTANT, 'Europe/Prague');
    expect(withTimeOfDay(INSTANT, 'Europe/Prague', hours, minutes)).toBe(
      INSTANT,
    );
  });
});
