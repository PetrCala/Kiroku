/**
 * @jest-environment node
 *
 * Device timezone ≠ session/selected timezone.
 *
 * The rest of the suite runs under `TZ=utc`, which hides a whole class of bugs:
 * code that accidentally reads the *device* timezone instead of the session's
 * own timezone looks correct as long as the device is UTC. These tests assert
 * that resolution and bucketing depend only on the *session* timezone, and that
 * the no-timezone fallback in `isDifferentDay` tracks whatever the device tz is.
 *
 * The Jest process timezone is fixed at launch and cannot be changed reliably
 * mid-process (Node honours `TZ` only at startup, so `Intl` with an explicit
 * zone updates but date-fns `format`/the default zone do not). So instead of
 * mutating `process.env.TZ`, these expectations are written to hold under ANY
 * launch timezone: the session-tz assertions use fixed values (a device leak
 * would change them and fail), and the device-fallback assertion is checked
 * against the *actual* effective device tz. The file is verified by launching it
 * under several zones, e.g.:
 *
 *   TZ=America/Los_Angeles jest timezoneDeviceVsSession
 *   TZ=Pacific/Kiritimati   jest timezoneDeviceVsSession   // UTC+14
 *   TZ=Asia/Kolkata         jest timezoneDeviceVsSession   // UTC+5:30
 *
 * CI runs it under the default `TZ=utc`.
 */

import {formatInTimeZone} from 'date-fns-tz';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {resolveLocalParts} from '@libs/Statistics/localParts';
import type {
  DrinkingSession,
  DrinkingSessionArray,
  DrinkingSessionList,
} from '@src/types/onyx';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const UTC = 'UTC' as SelectedTimezone;
const TOKYO = 'Asia/Tokyo' as SelectedTimezone; // UTC+9
const LA = 'America/Los_Angeles' as SelectedTimezone; // UTC-8 (Jan)

/** The timezone the Jest process actually launched with. */
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Local-noon anchor: its `yyyy-MM-dd` label is the same under any device tz. */
function viewDay(year: number, monthZeroBased: number, day: number): Date {
  return new Date(year, monthZeroBased, day, 12);
}

// 10:00 UTC on 2024-01-15 (a Monday).
const INSTANT = Date.UTC(2024, 0, 15, 10, 0);

describe(`device tz = ${DEVICE_TZ} — session tz is the only input that matters`, () => {
  it('resolveLocalParts reads the session tz, not the device', () => {
    // Fixed expectations: were the device tz to leak in, a non-UTC launch would
    // shift these and fail.
    expect(resolveLocalParts(INSTANT, UTC)).toMatchObject({
      localDay: '2024-01-15',
      localHour: 10,
      calendarDow: 1,
      localIsoWeek: '2024-W03',
    });
    expect(resolveLocalParts(INSTANT, TOKYO)).toMatchObject({
      localDay: '2024-01-15',
      localHour: 19, // 10:00 UTC + 9
    });
    expect(resolveLocalParts(INSTANT, LA)).toMatchObject({
      localDay: '2024-01-15',
      localHour: 2, // 10:00 UTC − 8
    });
  });

  it('getSingleDayDrinkingSessions buckets by the session tz, not the device', () => {
    // A UTC-tagged session at 10:00 UTC belongs to Jan 15 in its own tz. Under a
    // +14 device a device-based window would push it off Jan 15, so stable
    // membership here proves the device tz never leaks in.
    const sessions: DrinkingSessionList = {
      u: {start_time: INSTANT, timezone: UTC},
    };
    expect(
      DSUtils.getSingleDayDrinkingSessions(viewDay(2024, 0, 15), sessions),
    ).toHaveLength(1);
    expect(
      DSUtils.getSingleDayDrinkingSessions(viewDay(2024, 0, 16), sessions),
    ).toHaveLength(0);
  });

  it('getSingleMonthDrinkingSessions buckets by the session tz, not the device', () => {
    const sessions: DrinkingSessionArray = [
      {start_time: INSTANT, timezone: UTC},
    ];
    expect(
      DSUtils.getSingleMonthDrinkingSessions(viewDay(2024, 0, 15), sessions),
    ).toHaveLength(1);
    expect(
      DSUtils.getSingleMonthDrinkingSessions(viewDay(2024, 1, 15), sessions),
    ).toHaveLength(0);
  });

  it('isDifferentDay falls back to the device tz when the session has none', () => {
    // 12:00 UTC can land on different calendar days depending on the device tz;
    // the no-timezone branch must use that device day, so it agrees with an
    // oracle built from the actual effective device tz.
    const session: DrinkingSession = {start_time: Date.UTC(2024, 0, 15, 12, 0)};
    const fmt = 'yyyy-MM-dd';
    const deviceDay = formatInTimeZone(session.start_time, DEVICE_TZ, fmt);
    const tokyoDay = formatInTimeZone(session.start_time, TOKYO, fmt);
    expect(DSUtils.isDifferentDay(session, TOKYO)).toBe(deviceDay !== tokyoDay);
  });
});
