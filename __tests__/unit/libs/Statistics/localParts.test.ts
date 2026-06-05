import {isoWeekLabel, resolveLocalParts} from '@libs/Statistics/localParts';
import type {LocalParts} from '@libs/Statistics/localParts';

/**
 * Independent reference: the straightforward "one `Intl.formatToParts` per
 * timestamp" resolution that `resolveLocalParts` replaced with a cached-offset
 * derivation. These must stay byte-identical — especially at DST transition
 * instants, where an off-by-one in the offset cache would surface.
 */
function referenceLocalParts(ts: number, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const fields: Record<string, string> = {};
  for (const part of formatter.formatToParts(ts)) {
    fields[part.type] = part.value;
  }
  const {year, month, day, hour} = fields;
  const localMidnightUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
  );
  return {
    localDay: `${year}-${month}-${day}`,
    localMonth: `${year}-${month}`,
    localHour: Number(hour) % 24,
    localIsoWeek: isoWeekLabel(localMidnightUtc),
    calendarDow: new Date(localMidnightUtc).getUTCDay(),
  };
}

const ZONES = [
  'UTC',
  'America/New_York', // -5 / -4 DST
  'Europe/London', // +0 / +1 DST
  'Asia/Tokyo', // +9, no DST
  'Asia/Kathmandu', // +5:45, no DST (sub-hour offset)
  'Australia/Lord_Howe', // +10:30 / +11 (30-minute DST)
];

const HOUR = 3_600_000;

describe('resolveLocalParts — byte-identical to a fresh Intl resolution', () => {
  it.each(ZONES)('matches the reference across a 3-year sweep (%s)', zone => {
    // Every 12h from 2023-01-01 to 2026-01-01 exercises both DST halves, both
    // transition months, leap day, and the cache's constant-month fast path.
    const start = Date.UTC(2023, 0, 1);
    const end = Date.UTC(2026, 0, 1);
    for (let ts = start; ts < end; ts += 12 * HOUR) {
      expect(resolveLocalParts(ts, zone)).toEqual(
        referenceLocalParts(ts, zone),
      );
    }
  });
});

describe('resolveLocalParts — exact DST transition instants', () => {
  // Dense ±2h minute-by-minute sweep straddling each jump: the offset flips
  // mid-window, so this is the strongest guard on the cached-offset path.
  const transitions: Array<{zone: string; instant: number; label: string}> = [
    {
      zone: 'America/New_York',
      instant: Date.UTC(2024, 2, 10, 7),
      label: 'NY spring-forward',
    },
    {
      zone: 'America/New_York',
      instant: Date.UTC(2024, 10, 3, 6),
      label: 'NY fall-back',
    },
    {
      // The exact instant date-fns-tz is documented to mishandle: 02:00 EST
      // jumps to 03:00 EDT at 07:00 UTC. The cached-offset path must match Intl.
      zone: 'America/New_York',
      instant: Date.UTC(2025, 2, 9, 7),
      label: 'NY spring-forward (2025)',
    },
    {
      zone: 'America/New_York',
      instant: Date.UTC(2025, 10, 2, 6),
      label: 'NY fall-back (2025)',
    },
    {
      zone: 'Europe/London',
      instant: Date.UTC(2024, 2, 31, 1),
      label: 'London spring-forward',
    },
    {
      zone: 'Europe/London',
      instant: Date.UTC(2024, 9, 27, 1),
      label: 'London fall-back',
    },
    {
      zone: 'Australia/Lord_Howe',
      instant: Date.UTC(2024, 3, 6, 15, 30),
      label: 'Lord Howe fall-back',
    },
  ];

  it.each(transitions)('is exact within ±2h of $label', ({zone, instant}) => {
    for (let ts = instant - 2 * HOUR; ts <= instant + 2 * HOUR; ts += 60_000) {
      expect(resolveLocalParts(ts, zone)).toEqual(
        referenceLocalParts(ts, zone),
      );
    }
  });

  it('returns distinct local hours either side of NY spring-forward', () => {
    const jump = Date.UTC(2024, 2, 10, 7); // 02:00 EST -> 03:00 EDT
    // One minute before the jump is 01:59 EST; the jump instant is 03:00 EDT.
    expect(
      resolveLocalParts(jump - 60_000, 'America/New_York')?.localHour,
    ).toBe(1);
    expect(resolveLocalParts(jump, 'America/New_York')?.localHour).toBe(3);
  });
});

describe('resolveLocalParts — cache behaviour within a month', () => {
  it('resolves many timestamps in one constant-offset month correctly', () => {
    // July has no transition in NY; every stamp must use the same -4h offset.
    for (let day = 1; day <= 28; day++) {
      const ts = Date.UTC(2024, 6, day, 17, 30); // 13:30 EDT
      expect(resolveLocalParts(ts, 'America/New_York')).toEqual(
        referenceLocalParts(ts, 'America/New_York'),
      );
    }
  });

  it('handles a transition month queried both before and after the jump', () => {
    const before = Date.UTC(2024, 2, 1, 12); // March, pre-spring-forward
    const after = Date.UTC(2024, 2, 20, 12); // March, post-spring-forward
    expect(resolveLocalParts(before, 'America/New_York')).toEqual(
      referenceLocalParts(before, 'America/New_York'),
    );
    expect(resolveLocalParts(after, 'America/New_York')).toEqual(
      referenceLocalParts(after, 'America/New_York'),
    );
    // Same wall hour (07:00 -> different offsets give different local hours)
    expect(resolveLocalParts(before, 'America/New_York')?.localHour).toBe(7); // 12:00 UTC = 07:00 EST
    expect(resolveLocalParts(after, 'America/New_York')?.localHour).toBe(8); // 12:00 UTC = 08:00 EDT
  });
});

describe('resolveLocalParts — exact named DST instants (America/New_York)', () => {
  const NY = 'America/New_York';

  it('skips the lost hour at the 2025 spring-forward (01:59 EST → 03:00 EDT)', () => {
    // The clock jumps 02:00 → 03:00 at 07:00 UTC; 02:xx local never exists.
    const jump = Date.UTC(2025, 2, 9, 7);
    expect(resolveLocalParts(jump - 60_000, NY)).toMatchObject({
      localDay: '2025-03-09',
      localHour: 1, // 06:59 UTC = 01:59 EST
    });
    expect(resolveLocalParts(jump, NY)).toMatchObject({
      localDay: '2025-03-09',
      localHour: 3, // 07:00 UTC = 03:00 EDT
    });
  });

  it('resolves the repeated hour at the 2025 fall-back (01:00 EDT then 01:00 EST)', () => {
    // The clock falls 02:00 → 01:00 at 06:00 UTC, so 01:00 local occurs twice.
    const fallBack = Date.UTC(2025, 10, 2, 6);
    expect(resolveLocalParts(fallBack - 60 * 60_000, NY)).toMatchObject({
      localDay: '2025-11-02',
      localHour: 1, // 05:00 UTC = 01:00 EDT (first pass)
    });
    expect(resolveLocalParts(fallBack, NY)).toMatchObject({
      localDay: '2025-11-02',
      localHour: 1, // 06:00 UTC = 01:00 EST (second pass)
    });
  });
});

describe('resolveLocalParts — the date-fns-tz failure instant', () => {
  // The header for localParts.ts cites date-fns-tz being off-by-one at the exact
  // spring-forward instant as the reason it uses Intl instead. London flips
  // 00:00→01:00 (GMT→BST) at 01:00 UTC, so the first BST instant is 02:00 local.
  // Pin that the Intl-backed path lands on 02:00 (date-fns-tz's miscount here is
  // host-tz-dependent, so we assert our own correctness rather than its bug).
  const londonSpringForward = Date.UTC(2025, 2, 30, 1, 0, 0);

  it('resolves the London spring-forward instant to 02:00 local', () => {
    expect(
      resolveLocalParts(londonSpringForward, 'Europe/London'),
    ).toMatchObject({localDay: '2025-03-30', localHour: 2});
  });

  it('agrees with the independent Intl reference at that instant', () => {
    expect(resolveLocalParts(londonSpringForward, 'Europe/London')).toEqual(
      referenceLocalParts(londonSpringForward, 'Europe/London'),
    );
  });
});

describe('resolveLocalParts — invalid timezone', () => {
  it('throws so the caller can skip the timestamp', () => {
    expect(() =>
      resolveLocalParts(Date.UTC(2024, 0, 1), 'Not/AZone'),
    ).toThrow();
  });
});
