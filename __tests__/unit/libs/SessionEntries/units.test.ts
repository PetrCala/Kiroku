/**
 * The single unit computation (Sessions v2 W1). A legacy session and its v2
 * twin (the same drinks as entries) must give identical numbers everywhere
 * drinks are summed: the session screens, the calendar day markings, the
 * monthly totals and the Statistics event stream.
 */
import {
  entrySdu,
  entryUnits,
  getSessionEntries,
  legacyBucketsToEntries,
  sumEntryCounts,
  sumEntryUnits,
} from '@libs/SessionEntries';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {
  calculateThisMonthDrinks,
  calculateThisMonthUnits,
  dateToDateData,
  getLastDrinkAddedTime,
  getUniqueDrinkTypesInSession,
  sessionsToDayMarking,
  sumSessionDrinks,
  sumSessionDrinksOfType,
} from '@libs/DataHandling';
import {buildDrinkEvents} from '@libs/Statistics';
import {sduFrom} from '@libs/Statistics/sdu';
import {buildSessionTimeParts} from '@libs/Statistics/sessionTimeParts';
import CONST from '@src/CONST';
import type {
  DrinkingSession,
  DrinksToUnits,
  Preferences,
} from '@src/types/onyx';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import {
  LEGACY_FIXTURE_OWNER_UID,
  LEGACY_FIXTURE_SESSION,
} from '../../../fixtures/legacySessionEntries';

/* eslint-disable @typescript-eslint/naming-convention -- drinks are keyed by ms timestamps */

const UNITS: DrinksToUnits = {
  small_beer: 0.5,
  beer: 1,
  cocktail: 1.5,
  other: 1,
  strong_shot: 1,
  weak_shot: 0.5,
  wine: 1.2,
};

const PREFERENCES = {
  first_day_of_week: 'Monday',
  units_to_colors: {orange: 10, yellow: 5},
  drinks_to_units: UNITS,
  theme: 'system',
} as unknown as Preferences;

const UTC = 'UTC' as SelectedTimezone;

/** The v2 twin of a legacy session: the same drinks, stored as entries. */
function toV2Twin(legacy: DrinkingSession, ownerUid: string): DrinkingSession {
  const {drinks, ...rest} = legacy;
  return {
    ...rest,
    schema_version: CONST.SESSION.SCHEMA_VERSION,
    name: 'Twin',
    visibility: CONST.SESSION.VISIBILITY.FRIENDS,
    entries: legacyBucketsToEntries(drinks, ownerUid),
  };
}

const legacy = LEGACY_FIXTURE_SESSION as DrinkingSession;
const twin = toV2Twin(legacy, LEGACY_FIXTURE_OWNER_UID);

describe('entryUnits / entrySdu', () => {
  const beer = {key: 'beer', count: 2} as const;

  it('multiplies the count by the per-type factor', () => {
    expect(entryUnits(beer, UNITS)).toBe(2);
    expect(entryUnits({key: 'wine', count: 3}, UNITS)).toBeCloseTo(3.6);
  });

  it('counts 0 without a factor map or for an unknown factor', () => {
    expect(entryUnits(beer, undefined)).toBe(0);
    expect(entryUnits(beer, {} as DrinksToUnits)).toBe(0);
  });

  it('computes SDU from the drink defaults when the entry has no overrides', () => {
    const defaults = CONST.DRINK_DEFAULTS.beer;
    expect(entrySdu(beer, CONST.DRINK_DEFAULTS)).toBeCloseTo(
      sduFrom(defaults.ml, defaults.abv) * 2,
    );
  });

  it('prefers per-entry volume and ABV overrides', () => {
    expect(
      entrySdu(
        {key: 'beer', count: 1, volume_ml: 1000, abv: 0.1},
        CONST.DRINK_DEFAULTS,
      ),
    ).toBeCloseTo(sduFrom(1000, 0.1));
    expect(
      entrySdu({key: 'beer', count: 1, volume_ml: 1000}, CONST.DRINK_DEFAULTS),
    ).toBeCloseTo(sduFrom(1000, CONST.DRINK_DEFAULTS.beer.abv));
  });

  it('is undefined when neither the entry nor the defaults resolve both values', () => {
    expect(entrySdu(beer, undefined)).toBeUndefined();
    expect(entrySdu(beer, {})).toBeUndefined();
    expect(
      entrySdu({key: 'beer', count: 1, volume_ml: 500}, {}),
    ).toBeUndefined();
  });

  it('sums units and counts over entries', () => {
    const entries = getSessionEntries(legacy);
    expect(sumEntryCounts(entries)).toBe(6);
    expect(sumEntryUnits(entries, UNITS)).toBeCloseTo(
      2 * 1 + 1 * 1.2 + 1 * 1 + 2 * 1.5,
    );
    expect(sumEntryUnits(entries, undefined)).toBe(0);
  });
});

describe('a legacy session and its v2 twin agree', () => {
  it('on total units, rounded and unrounded', () => {
    expect(DSUtils.calculateTotalUnits(twin, UNITS)).toBe(
      DSUtils.calculateTotalUnits(legacy, UNITS),
    );
    expect(DSUtils.calculateTotalUnits(twin, UNITS, true)).toBe(
      DSUtils.calculateTotalUnits(legacy, UNITS, true),
    );
    expect(DSUtils.calculateTotalUnits(legacy, UNITS)).toBeCloseTo(7.2);
  });

  it('on available units', () => {
    expect(DSUtils.calculateAvailableUnits(twin, UNITS)).toBe(
      DSUtils.calculateAvailableUnits(legacy, UNITS),
    );
  });

  it('on drink counts, per type and in total', () => {
    expect(sumSessionDrinks(twin)).toBe(sumSessionDrinks(legacy));
    expect(sumSessionDrinks(legacy)).toBe(6);
    Object.values(CONST.DRINKS.KEYS).forEach(key => {
      expect(sumSessionDrinksOfType(twin, key)).toBe(
        sumSessionDrinksOfType(legacy, key),
      );
    });
    expect(sumSessionDrinksOfType(legacy, 'other')).toBe(0);
    expect(sumSessionDrinksOfType(legacy, 'cocktail')).toBe(2);
  });

  it('on the most common drink, the drink types and the last drink time', () => {
    expect(DSUtils.determineSessionMostCommonDrink(twin)).toBe(
      DSUtils.determineSessionMostCommonDrink(legacy),
    );
    expect(getUniqueDrinkTypesInSession(twin)?.sort()).toEqual(
      getUniqueDrinkTypesInSession(legacy)?.sort(),
    );
    expect(getLastDrinkAddedTime(twin)).toBe(getLastDrinkAddedTime(legacy));
    expect(getLastDrinkAddedTime(legacy)).toBe(legacy.end_time);
  });

  it('on the calendar day marking and the monthly sums', () => {
    expect(sessionsToDayMarking([twin], PREFERENCES)).toEqual(
      sessionsToDayMarking([legacy], PREFERENCES),
    );
    const day = dateToDateData(new Date(legacy.start_time));
    expect(calculateThisMonthUnits(day, [twin], UNITS)).toBe(
      calculateThisMonthUnits(day, [legacy], UNITS),
    );
    expect(calculateThisMonthDrinks(day, [twin])).toBe(
      calculateThisMonthDrinks(day, [legacy]),
    );
  });

  it('on the precomputed time parts', () => {
    expect(buildSessionTimeParts(twin, 'Europe/Prague')).toEqual(
      buildSessionTimeParts(legacy, 'Europe/Prague'),
    );
  });

  it('on the Statistics event stream', () => {
    const uid = LEGACY_FIXTURE_OWNER_UID;
    const legacyEvents = buildDrinkEvents(
      {[uid]: {s1: legacy}},
      UNITS,
      CONST.DRINK_DEFAULTS,
      UTC,
      1,
    );
    const twinEvents = buildDrinkEvents(
      {[uid]: {s1: twin}},
      UNITS,
      CONST.DRINK_DEFAULTS,
      UTC,
      1,
    );
    expect(twinEvents).toEqual(legacyEvents);
    expect(legacyEvents).toHaveLength(4);
    // The wine entry carries overrides; its SDU comes from them, not defaults.
    const wine = legacyEvents.find(event => event.drinkKey === 'wine');
    expect(wine?.sdu).toBeCloseTo(sduFrom(200, 0.13));
    expect(wine?.units).toBeCloseTo(1.2);
  });

  it('on a session whose v2 twin carries tombstones', () => {
    const withTombstone: DrinkingSession = {
      ...twin,
      entries: {
        ...twin.entries,
        removed: {
          ts: legacy.start_time,
          key: 'strong_shot',
          count: 5,
          source: CONST.SESSION.ENTRY_SOURCE.PHONE,
          author_uid: LEGACY_FIXTURE_OWNER_UID,
          target_uid: LEGACY_FIXTURE_OWNER_UID,
          created_at: legacy.start_time,
          deleted: true,
        },
      },
    };
    expect(DSUtils.calculateTotalUnits(withTombstone, UNITS)).toBe(
      DSUtils.calculateTotalUnits(legacy, UNITS),
    );
    expect(sumSessionDrinks(withTombstone)).toBe(sumSessionDrinks(legacy));
  });
});
