import buildDrinkEvents from '@libs/Statistics/events';
import type {DrinkDefaults} from '@libs/Statistics/events';
import {
  buildSessionTimeParts,
  buildTimePartsPatchFromEvents,
  isStoredLocalParts,
} from '@libs/Statistics/sessionTimeParts';
import type {WeekStart} from '@libs/Statistics/types';
import type {DrinkKey, DrinksList} from '@src/types/onyx/Drinks';
import type DrinkingSession from '@src/types/onyx/DrinkingSession';
import type {
  SessionTimeParts,
  UserDrinkingSessionsList,
} from '@src/types/onyx/DrinkingSession';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const UTC = 'UTC' as SelectedTimezone;
const LONDON = 'Europe/London' as SelectedTimezone;
const TOKYO = 'Asia/Tokyo' as SelectedTimezone;

const UNITS: DrinksToUnits = {
  small_beer: 0.5,
  beer: 1,
  cocktail: 1.5,
  other: 1,
  strong_shot: 1,
  weak_shot: 0.5,
  wine: 1.5,
};

const DEFAULTS: DrinkDefaults = {
  beer: {ml: 500, abv: 0.05},
  wine: {ml: 150, abv: 0.12},
};

const MON: WeekStart = 1;

function makeDrinks(
  rows: Array<[ts: number, entries: Partial<Record<DrinkKey, number>>]>,
): DrinksList {
  const out: DrinksList = {};
  for (const [ts, entries] of rows) {
    out[ts] = entries;
  }
  return out;
}

/** Fresh single-user/single-session wrapper (defeats the module-level memo). */
function oneSession(
  session: Partial<DrinkingSession>,
): UserDrinkingSessionsList {
  return {u1: {s1: {start_time: session.start_time ?? 0, ...session}}};
}

describe('isStoredLocalParts', () => {
  it('accepts a well-formed entry', () => {
    expect(
      isStoredLocalParts({d: '2024-01-15', h: 11, w: '2024-W03', dow: 1}),
    ).toBe(true);
  });

  it('rejects wrong field types, nullish, and non-objects', () => {
    expect(isStoredLocalParts({d: 1, h: 11, w: '2024-W03', dow: 1})).toBe(
      false,
    );
    expect(isStoredLocalParts({d: '2024-01-15', h: '11', w: 'x', dow: 1})).toBe(
      false,
    );
    expect(isStoredLocalParts({d: '2024-01-15', h: 11, w: '2024-W03'})).toBe(
      false,
    );
    expect(isStoredLocalParts(null)).toBe(false);
    expect(isStoredLocalParts('nope')).toBe(false);
  });
});

describe('buildSessionTimeParts', () => {
  it('stores d/h/w/dow per timestamp in the given timezone', () => {
    // 2024-01-15 23:30 UTC → 2024-01-16 08:30 in Tokyo (UTC+9).
    const ts = Date.UTC(2024, 0, 15, 23, 30);
    const parts = buildSessionTimeParts(makeDrinks([[ts, {beer: 1}]]), TOKYO);
    expect(parts).toEqual({
      tz: TOKYO,
      byTs: {[ts]: {d: '2024-01-16', h: 8, w: '2024-W03', dow: 2}},
    });
  });

  it('returns undefined when there are no drinks', () => {
    expect(buildSessionTimeParts(undefined, UTC)).toBeUndefined();
    expect(buildSessionTimeParts({}, UTC)).toBeUndefined();
  });

  it('skips non-finite timestamp keys but keeps the finite ones', () => {
    const good = Date.UTC(2024, 0, 15, 11);
    const drinks: DrinksList = {
      NaN: {beer: 1},
      [good]: {beer: 1},
    };
    const parts = buildSessionTimeParts(drinks, UTC);
    expect(Object.keys(parts?.byTs ?? {})).toEqual([String(good)]);
  });
});

/**
 * The strongest correctness guarantee: events built from stored fields must be
 * byte-identical to events built by recomputing from the raw stamp, because the
 * write path and the read-path fallback share one resolver.
 */
describe('buildDrinkEvents — stored parts match the recompute path', () => {
  const cases: Array<[label: string, tz: SelectedTimezone, ts: number]> = [
    ['UTC midday', UTC, Date.UTC(2024, 0, 15, 11)],
    ['Tokyo cross-day', TOKYO, Date.UTC(2024, 0, 15, 23, 30)],
    // London spring-forward instant: 01:00Z = 02:00 BST (date-fns-tz says 03:00).
    ['London spring-forward', LONDON, Date.UTC(2021, 2, 28, 1, 0, 0)],
    // ISO-week boundary: 2021-01-01 belongs to 2020-W53.
    ['ISO week edge', UTC, Date.UTC(2021, 0, 1, 12)],
    // Leap day.
    ['leap day', UTC, Date.UTC(2024, 1, 29, 14)],
  ];

  it.each(cases)('%s', (_label, tz, ts) => {
    const drinks = makeDrinks([[ts, {beer: 2, wine: 1}]]);
    const withoutParts = buildDrinkEvents(
      oneSession({start_time: ts, end_time: ts, timezone: tz, drinks}),
      UNITS,
      DEFAULTS,
      UTC,
      MON,
    );
    const parts = buildSessionTimeParts(drinks, tz);
    const withParts = buildDrinkEvents(
      oneSession({
        start_time: ts,
        end_time: ts,
        timezone: tz,
        drinks,
        drinksTimeParts: parts,
      }),
      UNITS,
      DEFAULTS,
      UTC,
      MON,
    );
    expect(withParts).toEqual(withoutParts);
    expect(withParts.length).toBeGreaterThan(0);
  });
});

describe('buildDrinkEvents — stored-parts trust + tz guard', () => {
  const ts = Date.UTC(2024, 0, 15, 11);
  const drinks = makeDrinks([[ts, {beer: 1}]]);
  // Deliberately wrong stored fields, to observe whether the read path uses them.
  const bogus: SessionTimeParts = {
    tz: UTC,
    byTs: {[ts]: {d: '1999-12-31', h: 5, w: '1999-W52', dow: 4}},
  };

  it('uses stored fields verbatim when the tz tag matches the session tz', () => {
    const events = buildDrinkEvents(
      oneSession({
        start_time: ts,
        timezone: UTC,
        drinks,
        drinksTimeParts: bogus,
      }),
      UNITS,
      DEFAULTS,
      UTC,
      MON,
    );
    expect(events[0].localDay).toBe('1999-12-31');
    expect(events[0].localMonth).toBe('1999-12'); // derived from stored day
    expect(events[0].localHour).toBe(5);
    expect(events[0].localIsoWeek).toBe('1999-W52');
  });

  it('ignores stored fields (recomputes) when the tz tag does not match', () => {
    const events = buildDrinkEvents(
      // Session is UTC, but the stored map is tagged Tokyo → distrusted.
      oneSession({
        start_time: ts,
        timezone: UTC,
        drinks,
        drinksTimeParts: {...bogus, tz: TOKYO},
      }),
      UNITS,
      DEFAULTS,
      UTC,
      MON,
    );
    expect(events[0].localDay).toBe('2024-01-15');
    expect(events[0].localHour).toBe(11);
  });

  it('falls back per timestamp when a stored entry is corrupt', () => {
    const events = buildDrinkEvents(
      oneSession({
        start_time: ts,
        timezone: UTC,
        drinks,
        drinksTimeParts: {
          tz: UTC,
          byTs: {[ts]: {d: 123} as never},
        },
      }),
      UNITS,
      DEFAULTS,
      UTC,
      MON,
    );
    expect(events[0].localDay).toBe('2024-01-15');
    expect(events[0].localHour).toBe(11);
  });
});

describe('buildTimePartsPatchFromEvents — backfill round-trip', () => {
  // Sunday in Tokyo with weekStart=Monday exercises the dow rotation inverse.
  const ts = Date.UTC(2024, 0, 14, 3, 0); // 2024-01-14 12:00 in Tokyo (Sunday)
  const drinks = makeDrinks([[ts, {beer: 1, wine: 2}]]);

  function freshSessions(parts?: SessionTimeParts): UserDrinkingSessionsList {
    return oneSession({
      start_time: ts,
      end_time: ts,
      timezone: TOKYO,
      drinks,
      drinksTimeParts: parts,
    });
  }

  it('reconstructs a patch whose stored parts reproduce the events exactly', () => {
    const base = freshSessions();
    const events = buildDrinkEvents(base, UNITS, DEFAULTS, UTC, MON);

    const patch = buildTimePartsPatchFromEvents(events, base, UTC, MON);
    expect(patch).not.toBeNull();
    const reconstructed = patch?.u1?.s1?.drinksTimeParts;
    expect(reconstructed?.tz).toBe(TOKYO);

    // Feed the reconstructed parts back through events: must match byte-for-byte.
    const afterBackfill = buildDrinkEvents(
      freshSessions(reconstructed),
      UNITS,
      DEFAULTS,
      UTC,
      MON,
    );
    expect(afterBackfill).toEqual(events);
    // It also matches what the write path would have produced directly.
    expect(reconstructed).toEqual(buildSessionTimeParts(drinks, TOKYO));
  });

  it('returns null once every session already has valid parts (converges)', () => {
    const withParts = freshSessions(buildSessionTimeParts(drinks, TOKYO));
    const events = buildDrinkEvents(withParts, UNITS, DEFAULTS, UTC, MON);
    expect(
      buildTimePartsPatchFromEvents(events, withParts, UTC, MON),
    ).toBeNull();
  });

  it('re-tags when the existing parts were computed under a different tz', () => {
    const stale = freshSessions({
      tz: LONDON,
      byTs: {[ts]: {d: '1999-12-31', h: 5, w: '1999-W52', dow: 4}},
    });
    const events = buildDrinkEvents(stale, UNITS, DEFAULTS, UTC, MON);
    const patch = buildTimePartsPatchFromEvents(events, stale, UTC, MON);
    expect(patch?.u1?.s1?.drinksTimeParts.tz).toBe(TOKYO);
  });

  it('returns null for an empty event list', () => {
    expect(
      buildTimePartsPatchFromEvents([], freshSessions(), UTC, MON),
    ).toBeNull();
  });
});
