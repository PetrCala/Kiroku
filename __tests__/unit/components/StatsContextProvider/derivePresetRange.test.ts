import {endOfDay, startOfMonth, startOfWeek, startOfYear} from 'date-fns';
import derivePresetRange from '@components/StatsContextProvider/derivePresetRange';
import DateUtils from '@libs/DateUtils';

// 2026-05-15 (Friday) 12:00:00Z. Picked so the W preset is non-trivial and
// 6M lands exactly on 2025-11-15.
const NOW = new Date('2026-05-15T12:00:00Z');

describe('derivePresetRange', () => {
  it('W → startOfWeek(now, {weekStartsOn}) … endOfDay(now)', () => {
    const {start, end} = derivePresetRange({preset: 'W', now: NOW});

    expect(start).toEqual(
      startOfWeek(NOW, {weekStartsOn: DateUtils.getWeekStartsOn()}),
    );
    expect(end).toEqual(endOfDay(NOW));
  });

  it('M → startOfMonth(now) … endOfDay(now)', () => {
    const {start, end} = derivePresetRange({preset: 'M', now: NOW});

    expect(start).toEqual(startOfMonth(NOW));
    expect(end).toEqual(endOfDay(NOW));
  });

  it('6M → six months back, normalised to startOfDay', () => {
    const {start, end} = derivePresetRange({preset: '6M', now: NOW});

    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(10); // November
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(end).toEqual(endOfDay(NOW));
  });

  it('Y → year-to-date (startOfYear(now) … endOfDay(now))', () => {
    const {start, end} = derivePresetRange({preset: 'Y', now: NOW});

    expect(start).toEqual(startOfYear(NOW));
    expect(end).toEqual(endOfDay(NOW));
  });

  it('All with earliestSessionAt uses it as the floor', () => {
    const earliest = new Date('2024-03-01T00:00:00Z');
    const {start, end} = derivePresetRange({
      preset: 'All',
      now: NOW,
      earliestSessionAt: earliest,
    });

    expect(start).toEqual(earliest);
    expect(end).toEqual(endOfDay(NOW));
  });

  it('All without earliestSessionAt falls back to startOfDay(now)', () => {
    const {start} = derivePresetRange({preset: 'All', now: NOW});

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(4);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
  });

  it('Custom returns the stored range verbatim', () => {
    const customStart = new Date('2026-01-10T00:00:00Z');
    const customEnd = new Date('2026-02-20T23:59:59Z');
    const {start, end} = derivePresetRange({
      preset: 'Custom',
      now: NOW,
      customStart,
      customEnd,
    });

    expect(start).toEqual(customStart);
    expect(end).toEqual(customEnd);
  });

  it('Custom with no stored range falls back to current month', () => {
    const {start, end} = derivePresetRange({preset: 'Custom', now: NOW});

    expect(start).toEqual(startOfMonth(NOW));
    expect(end).toEqual(endOfDay(NOW));
  });
});
