import {
  getSessionEntries,
  getSessionEntriesOfType,
  legacyBucketsToEntries,
  legacyEntryId,
  normalizeBucketEntry,
} from '@libs/SessionEntries';
import CONST from '@src/CONST';
import type {DrinkingSession, SessionEntries} from '@src/types/onyx';
import {
  LEGACY_FIXTURE_ENTRIES,
  LEGACY_FIXTURE_OWNER_UID,
  LEGACY_FIXTURE_SESSION,
} from '../../../fixtures/legacySessionEntries';

/* eslint-disable @typescript-eslint/naming-convention -- drinks are keyed by ms timestamps */

const OWNER = 'uid-owner';
const TS1 = 1_700_000_000_000;
const TS2 = 1_700_000_060_000;

describe('legacyEntryId', () => {
  it('derives the same id for the same timestamp and key', () => {
    expect(legacyEntryId(TS1, 'beer')).toBe(legacyEntryId(TS1, 'beer'));
    expect(legacyEntryId(TS1, 'beer')).toBe(`legacy-${TS1}-beer`);
  });

  it('separates keys and timestamps', () => {
    expect(legacyEntryId(TS1, 'beer')).not.toBe(legacyEntryId(TS1, 'wine'));
    expect(legacyEntryId(TS1, 'beer')).not.toBe(legacyEntryId(TS2, 'beer'));
  });

  it('never has the length of a push id', () => {
    Object.values(CONST.DRINKS.KEYS).forEach(key => {
      expect(legacyEntryId(TS1, key).length).not.toBe(20);
    });
  });
});

describe('normalizeBucketEntry', () => {
  it('accepts a positive count and the object form', () => {
    expect(normalizeBucketEntry(2)).toEqual({count: 2});
    expect(normalizeBucketEntry({count: 1, volume_ml: 200, abv: 0.13})).toEqual(
      {count: 1, volume_ml: 200, abv: 0.13},
    );
    expect(normalizeBucketEntry({count: 3})).toEqual({count: 3});
  });

  it('rejects zero, negative, non-finite and malformed values', () => {
    expect(normalizeBucketEntry(0)).toBeNull();
    expect(normalizeBucketEntry(-1)).toBeNull();
    expect(normalizeBucketEntry(Number.NaN)).toBeNull();
    expect(normalizeBucketEntry({count: 0})).toBeNull();
    expect(normalizeBucketEntry({count: 'x'})).toBeNull();
    expect(normalizeBucketEntry('2')).toBeNull();
    expect(normalizeBucketEntry(null)).toBeNull();
  });

  it('drops non-finite overrides but keeps the count', () => {
    expect(normalizeBucketEntry({count: 1, volume_ml: Number.NaN})).toEqual({
      count: 1,
    });
  });
});

describe('legacyBucketsToEntries', () => {
  it('matches the shared fixture exactly', () => {
    expect(
      legacyBucketsToEntries(
        LEGACY_FIXTURE_SESSION.drinks,
        LEGACY_FIXTURE_OWNER_UID,
      ),
    ).toEqual(LEGACY_FIXTURE_ENTRIES);
  });

  it('is deterministic', () => {
    const a = legacyBucketsToEntries(LEGACY_FIXTURE_SESSION.drinks, OWNER);
    const b = legacyBucketsToEntries(LEGACY_FIXTURE_SESSION.drinks, OWNER);
    expect(a).toEqual(b);
  });

  it('skips unknown drink keys and non-finite timestamps', () => {
    const entries = legacyBucketsToEntries(
      {
        NaN: {beer: 1},
        [TS1]: {beer: 1, mead: 4} as Record<string, number>,
      },
      OWNER,
    );
    expect(Object.keys(entries)).toEqual([legacyEntryId(TS1, 'beer')]);
  });

  it('returns an empty map for undefined or empty buckets', () => {
    expect(legacyBucketsToEntries(undefined, OWNER)).toEqual({});
    expect(legacyBucketsToEntries({}, OWNER)).toEqual({});
    expect(legacyBucketsToEntries({[TS1]: {}}, OWNER)).toEqual({});
  });
});

describe('getSessionEntries', () => {
  const v2Entries: SessionEntries = {
    later: {
      ts: TS2,
      key: 'wine',
      count: 1,
      source: CONST.SESSION.ENTRY_SOURCE.PHONE,
      author_uid: OWNER,
      target_uid: OWNER,
      created_at: TS2,
    },
    earlier: {
      ts: TS1,
      key: 'beer',
      count: 2,
      source: CONST.SESSION.ENTRY_SOURCE.WATCH,
      author_uid: OWNER,
      target_uid: OWNER,
      created_at: TS1,
    },
    gone: {
      ts: TS1,
      key: 'cocktail',
      count: 1,
      source: CONST.SESSION.ENTRY_SOURCE.PHONE,
      author_uid: OWNER,
      target_uid: OWNER,
      created_at: TS1,
      deleted: true,
    },
    sameTsAsEarlier: {
      ts: TS1,
      key: 'other',
      count: 1,
      source: CONST.SESSION.ENTRY_SOURCE.PHONE,
      author_uid: OWNER,
      target_uid: OWNER,
      created_at: TS1,
    },
  };
  const v2: DrinkingSession = {
    schema_version: CONST.SESSION.SCHEMA_VERSION,
    start_time: TS1,
    end_time: TS2,
    entries: v2Entries,
  };

  it('returns v2 entries minus tombstones, sorted by time then id', () => {
    expect(getSessionEntries(v2).map(entry => entry.id)).toEqual([
      'earlier',
      'sameTsAsEarlier',
      'later',
    ]);
  });

  it('returns [] for a v2 session without entries yet', () => {
    expect(
      getSessionEntries({schema_version: 2, start_time: TS1, end_time: TS2}),
    ).toEqual([]);
  });

  it('skips v2 entries with a non-finite ts or a non-positive count', () => {
    const corrupt: DrinkingSession = {
      schema_version: CONST.SESSION.SCHEMA_VERSION,
      start_time: TS1,
      entries: {
        ok: v2Entries.earlier,
        badTs: {...v2Entries.later, ts: Number.NaN},
        zero: {...v2Entries.later, count: 0},
      },
    };
    expect(getSessionEntries(corrupt).map(entry => entry.id)).toEqual(['ok']);
  });

  it('converts a legacy session with the fixture ids and fields', () => {
    const entries = getSessionEntries(
      LEGACY_FIXTURE_SESSION as DrinkingSession,
      LEGACY_FIXTURE_OWNER_UID,
    );
    const asMap = Object.fromEntries(
      entries.map(({id, ...entry}) => [id, entry]),
    );
    expect(asMap).toEqual(LEGACY_FIXTURE_ENTRIES);
    expect(entries.map(entry => entry.ts)).toEqual(
      [...entries.map(entry => entry.ts)].sort((a, b) => a - b),
    );
  });

  it('attributes legacy entries to the owner when one is given', () => {
    const [entry] = getSessionEntries(
      {start_time: TS1, drinks: {[TS1]: {beer: 1}}},
      OWNER,
    );
    expect(entry.author_uid).toBe(OWNER);
    expect(entry.target_uid).toBe(OWNER);
    expect(entry.source).toBe(CONST.SESSION.ENTRY_SOURCE.PHONE);
    expect(entry.created_at).toBe(TS1);
  });

  it('returns [] for null, undefined and a session with no drinks', () => {
    expect(getSessionEntries(undefined)).toEqual([]);
    expect(getSessionEntries(null)).toEqual([]);
    expect(getSessionEntries({start_time: TS1})).toEqual([]);
    expect(getSessionEntries({start_time: TS1, drinks: {}})).toEqual([]);
  });

  it('memoises on the session object identity', () => {
    const session: DrinkingSession = {
      start_time: TS1,
      drinks: {[TS1]: {beer: 1}},
    };
    expect(getSessionEntries(session)).toBe(getSessionEntries(session));
    expect(getSessionEntries({...session})).not.toBe(
      getSessionEntries(session),
    );
    // A different owner recomputes, then caches again.
    const forOwner = getSessionEntries(session, OWNER);
    expect(forOwner).not.toBe(getSessionEntries(session));
    expect(getSessionEntries(session, OWNER)).toBe(forOwner);
  });

  it('filters by drink type', () => {
    expect(getSessionEntriesOfType(v2, 'beer').map(e => e.id)).toEqual([
      'earlier',
    ]);
    expect(getSessionEntriesOfType(v2, 'strong_shot')).toEqual([]);
  });
});
