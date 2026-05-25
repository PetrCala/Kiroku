import buildDrinkEvents from '@libs/Statistics/events';
import type {DrinkDefaults} from '@libs/Statistics/events';
import {sduFrom} from '@libs/Statistics/sdu';
import type {WeekStart} from '@libs/Statistics/types';
import type Drinks from '@src/types/onyx/Drinks';
import type {DrinkKey, DrinksList} from '@src/types/onyx/Drinks';
import type DrinkingSession from '@src/types/onyx/DrinkingSession';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

type DrinkEntryInput =
  | number
  | {count: number; volume_ml?: number; abv?: number};

function makeDrinks(
  rows: Array<
    [ts: number, entries: Partial<Record<DrinkKey, DrinkEntryInput>>]
  >,
): DrinksList {
  const out: Record<string, Drinks> = {};
  for (const [ts, entries] of rows) {
    out[String(ts)] = entries;
  }
  return out;
}

type SessionInput = {
  start: number;
  end?: number;
  timezone?: SelectedTimezone;
  blackout?: boolean;
  ongoing?: boolean;
  drinks?: DrinksList;
};

function makeMultiUser(
  shape: Record<UserID, Record<string, SessionInput>>,
): UserDrinkingSessionsList {
  const out: UserDrinkingSessionsList = {};
  for (const userId of Object.keys(shape)) {
    const userSessions: Record<string, DrinkingSession> = {};
    for (const sid of Object.keys(shape[userId])) {
      const input = shape[userId][sid];
      const session: DrinkingSession = {start_time: input.start};
      if (input.end !== undefined) {
        session.end_time = input.end;
      }
      if (input.timezone !== undefined) {
        session.timezone = input.timezone;
      }
      if (input.blackout !== undefined) {
        session.blackout = input.blackout;
      }
      if (input.ongoing !== undefined) {
        session.ongoing = input.ongoing;
      }
      if (input.drinks !== undefined) {
        session.drinks = input.drinks;
      }
      userSessions[sid] = session;
    }
    out[userId] = userSessions;
  }
  return out;
}

const UTC = 'UTC' as SelectedTimezone;
const LONDON = 'Europe/London' as SelectedTimezone;
const NEW_YORK = 'America/New_York' as SelectedTimezone;
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
  small_beer: {ml: 330, abv: 0.05},
  beer: {ml: 500, abv: 0.05},
  cocktail: {ml: 250, abv: 0.1},
  other: {ml: 200, abv: 0.1},
  strong_shot: {ml: 40, abv: 0.4},
  weak_shot: {ml: 40, abv: 0.2},
  wine: {ml: 150, abv: 0.12},
};

const MON: WeekStart = 1;
const SUN: WeekStart = 0;

describe('buildDrinkEvents — empty inputs', () => {
  it('returns [] for undefined sessions', () => {
    expect(buildDrinkEvents(undefined, UNITS, DEFAULTS, UTC, MON)).toEqual([]);
  });

  it('returns [] for empty multi-user object', () => {
    expect(buildDrinkEvents({}, UNITS, DEFAULTS, UTC, MON)).toEqual([]);
  });

  it('returns [] when every session has no drinks', () => {
    const sessions = makeMultiUser({
      u1: {s1: {start: Date.UTC(2024, 0, 15, 10)}},
    });
    expect(buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON)).toEqual([]);
  });
});

describe('buildDrinkEvents — drink entry shapes', () => {
  it('emits one event per (timestamp, drink type) from a legacy numeric entry', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 11), {beer: 2}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: 'u1',
      sessionId: 's1',
      drinkKey: 'beer',
      count: 2,
      units: 2,
    });
    // SDU from defaults: 500ml beer at 5% × 2 = sduFrom(500,0.05)*2 ≈ 3.945
    expect(events[0].sdu).toBeCloseTo(sduFrom(500, 0.05) * 2, 6);
  });

  it('omits sdu for legacy numeric entry when no defaults are supplied', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 11), {beer: 2}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, undefined, UTC, MON);
    expect(events).toHaveLength(1);
    expect(events[0].sdu).toBeUndefined();
    expect(events[0].units).toBe(2);
  });

  it('uses per-entry volume_ml + abv overrides for sdu when present', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: makeDrinks([
            [
              Date.UTC(2024, 0, 15, 11),
              {wine: {count: 1, volume_ml: 200, abv: 0.14}},
            ],
          ]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(1);
    expect(events[0].sdu).toBeCloseTo(sduFrom(200, 0.14), 6);
  });

  it('falls back to drink_defaults when v2-A entry omits overrides', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 11), {wine: {count: 2}}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(1);
    expect(events[0].sdu).toBeCloseTo(sduFrom(150, 0.12) * 2, 6);
  });

  it('omits sdu when v2-A entry has no overrides and no defaults', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 11), {wine: {count: 1}}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, undefined, UTC, MON);
    expect(events[0].sdu).toBeUndefined();
  });

  it('skips malformed and non-positive entries', () => {
    const malformed: Record<string, unknown> = {
      beer: 0,
      wine: -1,
      cocktail: 'two',
      other: Number.NaN,
    };
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: {
            [Date.UTC(2024, 0, 15, 11)]: malformed,
          },
        },
      },
    });
    expect(buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON)).toEqual([]);
  });

  it('handles mixed legacy + v2-A entries at the same timestamp', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: makeDrinks([
            [
              Date.UTC(2024, 0, 15, 11),
              {beer: 1, wine: {count: 1, volume_ml: 100, abv: 0.12}},
            ],
          ]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(2);
    const beerEvent = events.find(e => e.drinkKey === 'beer');
    const wineEvent = events.find(e => e.drinkKey === 'wine');
    expect(beerEvent?.units).toBe(1);
    expect(wineEvent?.sdu).toBeCloseTo(sduFrom(100, 0.12), 6);
  });
});

describe('buildDrinkEvents — session filtering', () => {
  it('excludes ongoing sessions', () => {
    const sessions = makeMultiUser({
      u1: {
        live: {
          start: Date.UTC(2024, 0, 15, 10),
          ongoing: true,
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 11), {beer: 1}]]),
        },
        done: {
          start: Date.UTC(2024, 0, 14, 10),
          drinks: makeDrinks([[Date.UTC(2024, 0, 14, 11), {beer: 1}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(1);
    expect(events[0].sessionId).toBe('done');
  });

  it('skips sessions with non-finite start_time', () => {
    const sessions = makeMultiUser({
      u1: {
        bad: {
          start: Number.NaN,
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 11), {beer: 1}]]),
        },
        good: {
          start: Date.UTC(2024, 0, 14, 10),
          drinks: makeDrinks([[Date.UTC(2024, 0, 14, 11), {beer: 1}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(1);
    expect(events[0].sessionId).toBe('good');
  });

  it('skips drink entries with non-finite timestamp keys', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: {
            // Onyx persistence has produced 'NaN' keys in the wild.
            NaN: {beer: 1},
            [Date.UTC(2024, 0, 15, 11)]: {beer: 1},
          },
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(1);
    expect(events[0].ts).toBe(Date.UTC(2024, 0, 15, 11));
  });
});

describe('buildDrinkEvents — derived session fields', () => {
  it('computes sessionDurationMin when end_time is present', () => {
    const start = Date.UTC(2024, 0, 15, 10);
    const end = start + 90 * 60_000;
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start,
          end,
          drinks: makeDrinks([[start + 30 * 60_000, {beer: 1}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events[0].sessionDurationMin).toBe(90);
  });

  it('omits sessionDurationMin when end_time is missing', () => {
    const start = Date.UTC(2024, 0, 15, 10);
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start,
          drinks: makeDrinks([[start + 30 * 60_000, {beer: 1}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events[0].sessionDurationMin).toBeUndefined();
  });

  it('propagates blackout flag onto every event in the session', () => {
    const start = Date.UTC(2024, 0, 15, 10);
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start,
          blackout: true,
          drinks: makeDrinks([
            [start + 10 * 60_000, {beer: 1}],
            [start + 60 * 60_000, {wine: 1}],
          ]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(2);
    expect(events.every(e => e.blackoutSession === true)).toBe(true);
  });
});

describe('buildDrinkEvents — timezone handling', () => {
  it('uses per-session timezone over the caller-supplied default', () => {
    // 23:30 UTC on 2024-01-15 → 08:30 on 2024-01-16 in Tokyo (UTC+9)
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 23, 30),
          timezone: TOKYO,
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 23, 30), {beer: 1}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events[0].localDay).toBe('2024-01-16');
    expect(events[0].localHour).toBe(8);
  });

  it('falls back to the caller timezone when session.timezone is undefined', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 22),
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 22), {beer: 1}]]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, NEW_YORK, MON);
    // 22:00 UTC = 17:00 EST (Jan 15)
    expect(events[0].localDay).toBe('2024-01-15');
    expect(events[0].localHour).toBe(17);
  });
});

describe('buildDrinkEvents — day-of-week rotation', () => {
  it('rotates Sunday to localDow=6 when weekStart=Monday', () => {
    const sun = Date.UTC(2024, 0, 14, 12); // Sunday
    const sessions = makeMultiUser({
      u1: {s1: {start: sun, drinks: makeDrinks([[sun, {beer: 1}]])}},
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events[0].localDow).toBe(6);
  });

  it('keeps Sunday at localDow=0 when weekStart=Sunday', () => {
    const sun = Date.UTC(2024, 0, 14, 12); // Sunday
    const sessions = makeMultiUser({
      u1: {s1: {start: sun, drinks: makeDrinks([[sun, {beer: 1}]])}},
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, SUN);
    expect(events[0].localDow).toBe(0);
  });

  it('isWeekend stays calendar-bound regardless of weekStart', () => {
    const sat = Date.UTC(2024, 0, 13, 12);
    const mon = Date.UTC(2024, 0, 15, 12);
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: sat,
          drinks: makeDrinks([
            [sat, {beer: 1}],
            [mon, {beer: 1}],
          ]),
        },
      },
    });
    const monStart = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    const sunStart = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, SUN);
    const monWeekendFlags = monStart.map(e => e.isWeekend);
    const sunWeekendFlags = sunStart.map(e => e.isWeekend);
    expect(monWeekendFlags).toEqual([true, false]);
    expect(sunWeekendFlags).toEqual([true, false]);
  });
});

describe('buildDrinkEvents — calendar edge cases', () => {
  it('formats 2024-02-29 (leap day) correctly', () => {
    const ts = Date.UTC(2024, 1, 29, 14);
    const sessions = makeMultiUser({
      u1: {s1: {start: ts, drinks: makeDrinks([[ts, {beer: 1}]])}},
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events[0].localDay).toBe('2024-02-29');
    expect(events[0].localMonth).toBe('2024-02');
  });

  it('places 2020-12-31 and 2021-01-01 both in ISO week 2020-W53', () => {
    // The week-boundary bug from feat/graphs: a naive (year, weekNum) tuple
    // assigned 2021-01-01 to "2021-W53". ISO 8601 keeps both days in 2020-W53.
    const dec31 = Date.UTC(2020, 11, 31, 12);
    const jan01 = Date.UTC(2021, 0, 1, 12);
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: dec31,
          drinks: makeDrinks([
            [dec31, {beer: 1}],
            [jan01, {beer: 1}],
          ]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events.map(e => e.localIsoWeek)).toEqual(['2020-W53', '2020-W53']);
  });

  it('produces correct localHour across DST forward boundary in Europe/London', () => {
    // 2024-03-31 01:30 BST = 00:30 UTC; an hour later, 03:30 BST = 02:30 UTC.
    const beforeJump = Date.UTC(2024, 2, 31, 0, 30); // 01:30 BST? actually UK is GMT until 01:00 UTC on this day. Use 00:30 UTC = 00:30 GMT.
    const afterJump = Date.UTC(2024, 2, 31, 2, 30); // 03:30 BST (clock skipped 01:00 → 02:00)
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: beforeJump,
          drinks: makeDrinks([
            [beforeJump, {beer: 1}],
            [afterJump, {beer: 1}],
          ]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, LONDON, MON);
    // Before the jump: 00:30 UTC = 00:30 GMT (London still on GMT)
    expect(events[0].localHour).toBe(0);
    expect(events[0].localDay).toBe('2024-03-31');
    // After the jump: 02:30 UTC = 03:30 BST (London on BST after 01:00 UTC)
    expect(events[1].localHour).toBe(3);
    expect(events[1].localDay).toBe('2024-03-31');
  });

  it('produces correct localHour across DST backward boundary in Europe/London', () => {
    // 2024-10-27 00:30 UTC = 01:30 BST; 01:30 UTC = 01:30 GMT (clock fell back at 01:00 UTC).
    const beforeFall = Date.UTC(2024, 9, 27, 0, 30);
    const afterFall = Date.UTC(2024, 9, 27, 1, 30);
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: beforeFall,
          drinks: makeDrinks([
            [beforeFall, {beer: 1}],
            [afterFall, {beer: 1}],
          ]),
        },
      },
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, LONDON, MON);
    expect(events[0].localHour).toBe(1);
    expect(events[1].localHour).toBe(1);
    expect(events[0].localDay).toBe('2024-10-27');
    expect(events[1].localDay).toBe('2024-10-27');
  });
});

describe('buildDrinkEvents — multi-user attribution', () => {
  it('tags events with the correct userId across multiple users', () => {
    const ts = Date.UTC(2024, 0, 15, 11);
    const sessions = makeMultiUser({
      alice: {s1: {start: ts, drinks: makeDrinks([[ts, {beer: 1}]])}},
      bob: {s1: {start: ts, drinks: makeDrinks([[ts, {wine: 1}]])}},
    });
    const events = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(events).toHaveLength(2);
    const alice = events.find(e => e.userId === 'alice');
    const bob = events.find(e => e.userId === 'bob');
    expect(alice?.drinkKey).toBe('beer');
    expect(bob?.drinkKey).toBe('wine');
  });
});

describe('buildDrinkEvents — memoisation', () => {
  it('returns the same array instance when called with identical references', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 11), {beer: 1}]]),
        },
      },
    });
    const a = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    const b = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    expect(b).toBe(a);
  });

  it('invalidates the cache when weekStart changes', () => {
    const sessions = makeMultiUser({
      u1: {
        s1: {
          start: Date.UTC(2024, 0, 15, 10),
          drinks: makeDrinks([[Date.UTC(2024, 0, 15, 11), {beer: 1}]]),
        },
      },
    });
    const a = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, MON);
    const b = buildDrinkEvents(sessions, UNITS, DEFAULTS, UTC, SUN);
    expect(b).not.toBe(a);
  });

  it('invalidates the cache when sessions reference changes', () => {
    const drinks = makeDrinks([[Date.UTC(2024, 0, 15, 11), {beer: 1}]]);
    const s1 = makeMultiUser({
      u1: {s1: {start: Date.UTC(2024, 0, 15, 10), drinks}},
    });
    const s2 = makeMultiUser({
      u1: {s1: {start: Date.UTC(2024, 0, 15, 10), drinks}},
    });
    const a = buildDrinkEvents(s1, UNITS, DEFAULTS, UTC, MON);
    const b = buildDrinkEvents(s2, UNITS, DEFAULTS, UTC, MON);
    expect(b).not.toBe(a);
    expect(b).toEqual(a);
  });
});
