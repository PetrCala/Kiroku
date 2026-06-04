/**
 * Correctness gate for the `buildDrinkEvents` optimization candidates
 * (see scripts/perf/statsCandidates.ts and STATS_PERF_REPORT.md).
 *
 * Each candidate must reproduce, byte-for-byte, the local wall-clock fields that
 * date-fns-tz's `formatInTimeZone` yields — the reference oracle. We sweep a
 * battery of hard timezones (half-hour / 45-min offsets, southern-hemisphere
 * DST, the 30-minute-DST Lord Howe zone) and pre-1970 instants, then assert all
 * three candidates agree with the oracle and with each other on a realistic
 * synthetic dataset.
 */
import {formatInTimeZone} from 'date-fns-tz';
import type {DrinksList} from '@src/types/onyx/Drinks';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {WeekStart} from '@libs/Statistics/types';
import {
  buildBaseline,
  buildDayBucket,
  buildOffsetTable,
} from '../../../../scripts/perf/statsCandidates';
import type {
  BuildDrinkEvents,
  DrinkDefaults,
} from '../../../../scripts/perf/statsCandidates';
import {
  generateDataset,
  DEFAULTS,
  UNITS,
} from '../../../../scripts/perf/statsDataset';

const MON: WeekStart = 1;

const CANDIDATES: Array<{name: string; fn: BuildDrinkEvents}> = [
  {name: '(a) baseline', fn: buildBaseline},
  {name: '(b) day-bucket', fn: buildDayBucket},
  {name: '(c) offset-table', fn: buildOffsetTable},
];

type Oracle = {
  localDay: string;
  localMonth: string;
  localHour: number;
  localIsoWeek: string;
  localDow: number;
  isWeekend: boolean;
};

const nativeFormatters = new Map<string, Intl.DateTimeFormat>();
function nativeFormatter(tz: string): Intl.DateTimeFormat {
  let f = nativeFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    nativeFormatters.set(tz, f);
  }
  return f;
}

/**
 * Reference oracle. Wall-clock fields (day / month / hour) come from the
 * platform's native `Intl` — the exact engine the app runs on, and the ground
 * truth at DST boundaries (date-fns-tz mis-reports the hour at the precise
 * spring-forward instant; see the dedicated test below). ISO week / DOW are
 * computed by date-fns from the civil date taken at NOON (never a transition
 * instant), giving an implementation independent of the candidates' own
 * day-count arithmetic.
 */
function oracle(ts: number, tz: string, weekStart: WeekStart): Oracle {
  const fields: Record<string, string> = {};
  for (const part of nativeFormatter(tz).formatToParts(ts)) {
    fields[part.type] = part.value;
  }
  const localDay = `${fields.year}-${fields.month}-${fields.day}`;
  const localMonth = `${fields.year}-${fields.month}`;
  const localHour = Number(fields.hour) % 24;

  const noonUtc = Date.UTC(
    Number(fields.year),
    Number(fields.month) - 1,
    Number(fields.day),
    12,
  );
  const localIsoWeek = formatInTimeZone(noonUtc, 'UTC', "RRRR-'W'II");
  // date-fns 'i' → 1=Mon..7=Sun; calendarDow 0=Sun..6=Sat is (iso % 7).
  const calendarDow = Number(formatInTimeZone(noonUtc, 'UTC', 'i')) % 7;
  const localDow = (calendarDow - weekStart + 7) % 7;
  const isWeekend = calendarDow === 0 || calendarDow === 6;
  return {localDay, localMonth, localHour, localIsoWeek, localDow, isWeekend};
}

/** A one-drink session at `ts` in `tz`, so each candidate yields one event. */
function singleEventSessions(
  ts: number,
  tz: SelectedTimezone,
): UserDrinkingSessionsList {
  const drinks: DrinksList = {[String(ts)]: {beer: 1}};
  return {
    u: {s: {start_time: ts, timezone: tz, drinks}},
  };
}

/** Timezones spanning the hard cases called out in the perf brief. */
const HARD_ZONES: string[] = [
  'UTC',
  'Europe/London', // EU DST
  'America/New_York', // US DST
  'Asia/Tokyo', // no DST, +9
  'Asia/Kolkata', // +5:30, no DST
  'Asia/Kathmandu', // +5:45, no DST
  'Australia/Sydney', // southern-hemisphere DST
  'Pacific/Auckland', // southern-hemisphere DST
  'Australia/Lord_Howe', // +10:30 / +11:00 — 30-minute DST
  'Pacific/Chatham', // +12:45 / +13:45
  'America/Sao_Paulo', // southern DST (abolished 2019)
];

describe('buildDrinkEvents candidates — oracle sweep across hard timezones', () => {
  // Sweep a multi-year window at a 7h11m stride (deliberately not aligned to
  // the hour/day grid) so samples land on varied wall-clock times, then add
  // explicit instants around DST transitions.
  const STRIDE = 7 * 3600000 + 11 * 60000;
  const START = Date.UTC(2017, 0, 1, 0, 0, 0);
  const END = Date.UTC(2026, 0, 1, 0, 0, 0);

  it.each(HARD_ZONES)('matches the date-fns oracle across %s', zone => {
    const tz = zone as SelectedTimezone;
    let checked = 0;
    for (let ts = START; ts < END; ts += STRIDE) {
      const want = oracle(ts, zone, MON);
      for (const {name, fn} of CANDIDATES) {
        const [ev] = fn(singleEventSessions(ts, tz), UNITS, DEFAULTS, tz, MON);
        if (
          ev.localDay !== want.localDay ||
          ev.localMonth !== want.localMonth ||
          ev.localHour !== want.localHour ||
          ev.localIsoWeek !== want.localIsoWeek ||
          ev.localDow !== want.localDow ||
          ev.isWeekend !== want.isWeekend
        ) {
          throw new Error(
            `${name} mismatch in ${zone} at ts=${ts} (${new Date(
              ts,
            ).toISOString()})\n  got:  ${JSON.stringify({
              localDay: ev.localDay,
              localMonth: ev.localMonth,
              localHour: ev.localHour,
              localIsoWeek: ev.localIsoWeek,
              localDow: ev.localDow,
              isWeekend: ev.isWeekend,
            })}\n  want: ${JSON.stringify(want)}`,
          );
        }
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(10000);
  });
});

describe('buildDrinkEvents candidates — explicit DST-transition instants', () => {
  // Bracket each transition: ±1 min, ±1 h around the documented UTC instant.
  type Probe = {zone: string; around: number; label: string};
  const probes: Probe[] = [
    {zone: 'Europe/London', around: Date.UTC(2024, 2, 31, 1), label: 'GMT→BST'},
    {zone: 'Europe/London', around: Date.UTC(2024, 9, 27, 1), label: 'BST→GMT'},
    {
      zone: 'America/New_York',
      around: Date.UTC(2024, 2, 10, 7),
      label: 'EST→EDT',
    },
    {
      zone: 'America/New_York',
      around: Date.UTC(2024, 10, 3, 6),
      label: 'EDT→EST',
    },
    {
      zone: 'Australia/Sydney',
      around: Date.UTC(2024, 3, 6, 16),
      label: 'AEDT→AEST',
    },
    {
      zone: 'Australia/Sydney',
      around: Date.UTC(2024, 9, 5, 16),
      label: 'AEST→AEDT',
    },
    {
      zone: 'Pacific/Auckland',
      around: Date.UTC(2024, 3, 6, 14),
      label: 'NZDT→NZST',
    },
    {
      zone: 'Australia/Lord_Howe',
      around: Date.UTC(2024, 3, 6, 15, 30),
      label: 'LHDT→LHST (30min)',
    },
    {
      zone: 'Australia/Lord_Howe',
      around: Date.UTC(2024, 9, 5, 16),
      label: 'LHST→LHDT (30min)',
    },
  ];

  const deltas = [
    -3600000,
    -60000,
    -1000,
    0,
    1000,
    60000,
    3600000,
    2 * 3600000,
  ];

  it.each(probes)(
    '$zone $label brackets match the oracle',
    ({zone, around}) => {
      const tz = zone as SelectedTimezone;
      for (const d of deltas) {
        const ts = around + d;
        const want = oracle(ts, zone, MON);
        for (const {name, fn} of CANDIDATES) {
          const [ev] = fn(
            singleEventSessions(ts, tz),
            UNITS,
            DEFAULTS,
            tz,
            MON,
          );
          expect({
            who: name,
            localDay: ev.localDay,
            localHour: ev.localHour,
            localIsoWeek: ev.localIsoWeek,
            localDow: ev.localDow,
            isWeekend: ev.isWeekend,
          }).toEqual({
            who: name,
            localDay: want.localDay,
            localHour: want.localHour,
            localIsoWeek: want.localIsoWeek,
            localDow: want.localDow,
            isWeekend: want.isWeekend,
          });
        }
      }
    },
  );
});

describe('buildDrinkEvents candidates — pre-1970 timestamps', () => {
  const preEpoch = [
    Date.UTC(1969, 6, 20, 20, 17), // moon landing
    Date.UTC(1965, 0, 1, 0, 30),
    Date.UTC(1955, 11, 31, 23, 30),
    Date.UTC(1945, 4, 8, 12),
    Date.UTC(1900, 0, 1, 0, 0),
  ];
  const zones: string[] = [
    'UTC',
    'Europe/London',
    'Asia/Kolkata',
    'Asia/Tokyo',
  ];

  it.each(zones)('matches the oracle for pre-1970 instants in %s', zone => {
    const tz = zone as SelectedTimezone;
    for (const ts of preEpoch) {
      const want = oracle(ts, zone, MON);
      for (const {name, fn} of CANDIDATES) {
        const [ev] = fn(singleEventSessions(ts, tz), UNITS, DEFAULTS, tz, MON);
        expect({
          who: name,
          localDay: ev.localDay,
          localMonth: ev.localMonth,
          localHour: ev.localHour,
        }).toEqual({
          who: name,
          localDay: want.localDay,
          localMonth: want.localMonth,
          localHour: want.localHour,
        });
      }
    }
  });
});

describe('finding: date-fns-tz mis-reports the spring-forward instant', () => {
  // At the exact spring-forward second the clock jumps 01:00→02:00 local, so
  // 01:00:00 UTC = 02:00 BST. Native Intl (and therefore every candidate)
  // reports hour 2; date-fns-tz reports hour 3. This is why the Intl-based
  // event builder is strictly MORE correct than the original date-fns-tz code.
  const ts = Date.UTC(2021, 2, 28, 1); // 2021-03-28 01:00:00 UTC, London

  it('native Intl and all candidates agree on hour 2', () => {
    const tz = 'Europe/London' as SelectedTimezone;
    const nativeHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(ts),
    );
    expect(nativeHour).toBe(2);
    for (const {fn} of CANDIDATES) {
      const [ev] = fn(singleEventSessions(ts, tz), UNITS, DEFAULTS, tz, MON);
      expect(ev.localHour).toBe(2);
    }
  });

  it('date-fns-tz disagrees (reports hour 3) — documented bug', () => {
    expect(Number(formatInTimeZone(ts, 'Europe/London', 'HH'))).toBe(3);
  });
});

describe('buildDrinkEvents candidates — cross-equality on synthetic data', () => {
  const zones: SelectedTimezone[] = [
    'Europe/London',
    'Australia/Lord_Howe',
    'Asia/Kathmandu',
    'Pacific/Auckland',
  ] as SelectedTimezone[];

  it.each(zones)(
    'b and c reproduce the baseline event stream exactly (%s)',
    zone => {
      const ds = generateDataset({
        years: 4,
        sessionDensity: 0.7,
        minTimestamps: 1,
        maxTimestamps: 6,
        minTypes: 1,
        maxTypes: 4,
        v2Fraction: 0.4,
        timezone: zone,
        seed: 42,
      });
      const defaults: DrinkDefaults = DEFAULTS;
      const base = buildBaseline(ds.sessions, UNITS, defaults, zone, MON);
      const b = buildDayBucket(ds.sessions, UNITS, defaults, zone, MON);
      const c = buildOffsetTable(ds.sessions, UNITS, defaults, zone, MON);
      expect(base.length).toBeGreaterThan(1000);
      expect(b).toEqual(base);
      expect(c).toEqual(base);
    },
  );
});
