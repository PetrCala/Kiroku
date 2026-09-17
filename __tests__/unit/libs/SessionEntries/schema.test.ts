import {isLegacySession, isSchemaV2Session} from '@libs/SessionEntries';
import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';

/* eslint-disable @typescript-eslint/naming-convention -- drinks are keyed by ms timestamps */

const legacy: DrinkingSession = {
  start_time: 1_700_000_000_000,
  end_time: 1_700_003_600_000,
  drinks: {1_700_000_000_000: {beer: 2}},
};

const v2: DrinkingSession = {
  schema_version: CONST.SESSION.SCHEMA_VERSION,
  name: 'Friday evening',
  visibility: CONST.SESSION.VISIBILITY.FRIENDS,
  start_time: 1_700_000_000_000,
  end_time: 1_700_003_600_000,
  entries: {
    entryA: {
      ts: 1_700_000_000_000,
      key: 'beer',
      count: 2,
      source: CONST.SESSION.ENTRY_SOURCE.PHONE,
      author_uid: 'uid-A',
      target_uid: 'uid-A',
      created_at: 1_700_000_000_000,
    },
  },
};

describe('SessionEntries schema guards', () => {
  it('recognises a v2 session by its schema_version', () => {
    expect(isSchemaV2Session(v2)).toBe(true);
    expect(isLegacySession(v2)).toBe(false);
  });

  it('treats a v2 session without entries yet as v2', () => {
    const fresh: DrinkingSession = {...v2};
    delete fresh.entries;
    expect(isSchemaV2Session(fresh)).toBe(true);
  });

  it('treats a session without schema_version as legacy', () => {
    expect(isLegacySession(legacy)).toBe(true);
    expect(isSchemaV2Session(legacy)).toBe(false);
  });

  it('treats a session with no drinks at all as legacy', () => {
    const empty: DrinkingSession = {start_time: 1, end_time: 2};
    expect(isLegacySession(empty)).toBe(true);
  });

  it('is false for null and undefined', () => {
    expect(isSchemaV2Session(undefined)).toBe(false);
    expect(isSchemaV2Session(null)).toBe(false);
    expect(isLegacySession(undefined)).toBe(false);
    expect(isLegacySession(null)).toBe(false);
  });
});
