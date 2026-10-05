import {
  buildFeedCardSummary,
  getOldestStartTime,
  sortSessionsNewestFirst,
} from '@libs/SessionFeed';
import CONST from '@src/CONST';
import type {DrinkingSession, DrinkingSessionList} from '@src/types/onyx';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const HOUR = 60 * 60 * 1000;
const UTC = 'UTC' as SelectedTimezone;
const START = Date.UTC(2026, 8, 18, 19, 0, 0); // Friday 2026-09-18 19:00 UTC
const NOW = START + 5 * HOUR;

const drinksToUnits = {
  small_beer: 1,
  beer: 2,
  wine: 1.5,
  weak_shot: 0.5,
  strong_shot: 1,
  cocktail: 2,
  other: 1,
};

const options = {
  drinksToUnits,
  drinkDefaults: CONST.DRINK_DEFAULTS,
  ownerUid: 'u1',
  now: NOW,
};

/** A finished v2 session: two beers and a wine, one photo. */
function v2Session(): DrinkingSession {
  return {
    schema_version: 2,
    name: 'Pub quiz',
    visibility: 'friends',
    start_time: START,
    end_time: START + 2 * HOUR,
    timezone: UTC,
    ongoing: false,
    entries: {
      e1: {
        ts: START,
        key: 'beer',
        count: 2,
        source: 'phone',
        author_uid: 'u1',
        target_uid: 'u1',
        created_at: START,
      },
      e2: {
        ts: START + HOUR,
        key: 'wine',
        count: 1,
        volume_ml: 200,
        abv: 0.13,
        source: 'phone',
        author_uid: 'u1',
        target_uid: 'u1',
        created_at: START + HOUR,
      },
      gone: {
        ts: START + HOUR,
        key: 'cocktail',
        count: 3,
        source: 'phone',
        author_uid: 'u1',
        target_uid: 'u1',
        created_at: START + HOUR,
        deleted: true,
      },
    },
    photos: {
      later: {path: 'b', w: 1, h: 1, added_at: START + HOUR, added_by: 'u1'},
      first: {path: 'a', w: 1, h: 1, added_at: START, added_by: 'u1'},
    },
  };
}

/** The same drinks as a legacy session: buckets, no name, no photos. */
function legacySession(): DrinkingSession {
  return {
    start_time: START,
    end_time: START + 2 * HOUR,
    timezone: UTC,
    ongoing: false,
    drinks: {
      [START]: {beer: 2},
      [START + HOUR]: {wine: 1},
    },
  };
}

describe('buildFeedCardSummary', () => {
  it('summarises a v2 session from its live entries only', () => {
    const summary = buildFeedCardSummary('s1', v2Session(), options);
    expect(summary).toMatchObject({
      sessionId: 's1',
      name: 'Pub quiz',
      startTime: START,
      isLive: false,
      durationMs: 2 * HOUR,
      // 2 beers × 2 + 1 wine × 1.5; the tombstoned cocktails count nothing.
      units: 5.5,
      drinkCount: 3,
      drinkCounts: [
        {key: 'beer', count: 2},
        {key: 'wine', count: 1},
      ],
      photoId: 'first',
      photoCount: 2,
      blackout: false,
    });
    // Beers at the 500 ml / 5 % default plus the wine at its own 200 ml / 13 %:
    // (500 × 0.05 × 0.789 × 2 + 200 × 0.13 × 0.789) / 10, to one decimal.
    expect(summary.sdu).toBe(6.0);
    expect(summary.photo?.path).toBe('a');
  });

  it('reads a legacy session through the adapter and names it by default', () => {
    const summary = buildFeedCardSummary('s2', legacySession(), options);
    expect(summary.units).toBe(5.5);
    expect(summary.drinkCount).toBe(3);
    expect(summary.drinkCounts).toEqual([
      {key: 'beer', count: 2},
      {key: 'wine', count: 1},
    ]);
    // Both drinks at their defaults: (500 × 0.05 × 0.789 × 2 + 150 × 0.12 × 0.789) / 10.
    expect(summary.sdu).toBe(5.4);
    expect(summary.name).toBe('Friday evening');
    expect(summary.photoId).toBeUndefined();
    expect(summary.photoCount).toBe(0);
  });

  it('measures a live session up to now and flags it', () => {
    const session = {...legacySession(), ongoing: true, end_time: undefined};
    const summary = buildFeedCardSummary('s3', session, options);
    expect(summary.isLive).toBe(true);
    expect(summary.durationMs).toBe(5 * HOUR);
  });

  it('never reports a negative duration', () => {
    const session = {...legacySession(), end_time: START - HOUR};
    expect(buildFeedCardSummary('s4', session, options).durationMs).toBe(0);
  });

  it('counts 0 units without the per-drink factors and reports the blackout', () => {
    const session = {...legacySession(), blackout: true};
    const summary = buildFeedCardSummary('s5', session, {
      ...options,
      drinksToUnits: undefined,
    });
    expect(summary.units).toBe(0);
    expect(summary.blackout).toBe(true);
  });
});

describe('sortSessionsNewestFirst', () => {
  const list: DrinkingSessionList = {
    b: {start_time: 2000},
    c: {start_time: 3000},
    a: {start_time: 1000},
    tieLow: {start_time: 2000},
    broken: {start_time: Number.NaN},
  };

  it('orders by start_time descending, ties by key descending', () => {
    expect(sortSessionsNewestFirst(list).map(item => item.sessionId)).toEqual([
      'c',
      'tieLow',
      'b',
      'a',
    ]);
  });

  it('is empty for a missing or empty map', () => {
    expect(sortSessionsNewestFirst(undefined)).toEqual([]);
    expect(sortSessionsNewestFirst(null)).toEqual([]);
    expect(sortSessionsNewestFirst({})).toEqual([]);
  });

  it('exposes the oldest loaded start_time as the next cursor', () => {
    expect(getOldestStartTime(sortSessionsNewestFirst(list))).toBe(1000);
    expect(getOldestStartTime([])).toBeUndefined();
  });
});
