/**
 * Pins the legacy bucket to entry conversion (Sessions v2 W1, RFC §11).
 *
 * The same fixture lives in kiroku-cli at
 * `__tests__/fixtures/legacySessionEntries.ts`, where the backfill's copy of
 * the conversion is checked against it. Change both copies together: the app
 * adapter and the backfill must produce identical ids and entries for the
 * same legacy session.
 */

const LEGACY_FIXTURE_OWNER_UID = 'owner-uid-1';

const TS_A = 1_700_000_000_000;
const TS_B = 1_700_000_600_000;
const TS_C = 1_700_001_200_000;

/** A legacy session as stored under `user_drinking_sessions/{uid}/{id}`. */
const LEGACY_FIXTURE_SESSION = {
  start_time: TS_A,
  end_time: TS_C,
  timezone: 'Europe/Prague',
  type: 'live',
  ongoing: false,
  blackout: false,
  note: 'fixture',
  drinks: {
    [TS_A]: {beer: 2, wine: {count: 1, volume_ml: 200, abv: 0.13}},
    // `other: 0` carries no drink and is dropped.
    [TS_B]: {other: 0, strong_shot: 1},
    [TS_C]: {cocktail: {count: 2}},
  },
  drinksTimeParts: {
    tz: 'Europe/Prague',
    byTs: {[TS_A]: {d: '2023-11-14', h: 23, w: '2023-W46', dow: 2}},
  },
};

/** What the fixture session converts into, keyed by deterministic id. */
const LEGACY_FIXTURE_ENTRIES = {
  [`legacy-${TS_A}-beer`]: {
    ts: TS_A,
    key: 'beer',
    count: 2,
    source: 'phone',
    author_uid: LEGACY_FIXTURE_OWNER_UID,
    target_uid: LEGACY_FIXTURE_OWNER_UID,
    created_at: TS_A,
  },
  [`legacy-${TS_A}-wine`]: {
    ts: TS_A,
    key: 'wine',
    count: 1,
    volume_ml: 200,
    abv: 0.13,
    source: 'phone',
    author_uid: LEGACY_FIXTURE_OWNER_UID,
    target_uid: LEGACY_FIXTURE_OWNER_UID,
    created_at: TS_A,
  },
  [`legacy-${TS_B}-strong_shot`]: {
    ts: TS_B,
    key: 'strong_shot',
    count: 1,
    source: 'phone',
    author_uid: LEGACY_FIXTURE_OWNER_UID,
    target_uid: LEGACY_FIXTURE_OWNER_UID,
    created_at: TS_B,
  },
  [`legacy-${TS_C}-cocktail`]: {
    ts: TS_C,
    key: 'cocktail',
    count: 2,
    source: 'phone',
    author_uid: LEGACY_FIXTURE_OWNER_UID,
    target_uid: LEGACY_FIXTURE_OWNER_UID,
    created_at: TS_C,
  },
};

export {
  LEGACY_FIXTURE_ENTRIES,
  LEGACY_FIXTURE_OWNER_UID,
  LEGACY_FIXTURE_SESSION,
};
