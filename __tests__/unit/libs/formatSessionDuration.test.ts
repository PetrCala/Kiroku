/**
 * @jest-environment node
 */

import formatSessionDuration from '@libs/formatSessionDuration';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('formatSessionDuration', () => {
  it('drops the hours under an hour', () => {
    expect(formatSessionDuration(35 * MINUTE, 'en')).toBe('35m');
    expect(formatSessionDuration(0, 'en')).toBe('0m');
  });

  it('shows hours and minutes for a longer session', () => {
    expect(formatSessionDuration(4 * HOUR + 20 * MINUTE, 'en')).toBe('4h 20m');
    expect(formatSessionDuration(HOUR, 'en')).toBe('1h 0m');
  });

  it('keeps counting past a day, since that is still one session', () => {
    expect(formatSessionDuration(26 * HOUR + 5 * MINUTE, 'en')).toBe('26h 5m');
  });

  it('floors the minutes, so a session never reads longer than it was', () => {
    expect(formatSessionDuration(59 * 1000, 'en')).toBe('0m');
    expect(formatSessionDuration(2 * MINUTE - 1, 'en')).toBe('1m');
  });

  it('reads as zero for a negative or non-finite duration', () => {
    // A device whose clock skewed can close a session before it started.
    expect(formatSessionDuration(-HOUR, 'en')).toBe('0m');
    expect(formatSessionDuration(Number.NaN, 'en')).toBe('0m');
    expect(formatSessionDuration(Number.POSITIVE_INFINITY, 'en')).toBe('0m');
  });

  it("uses the locale's abbreviated units", () => {
    expect(formatSessionDuration(2 * HOUR + 3 * MINUTE, 'cs_cz')).toMatch(
      /^2.+ 3.+$/,
    );
  });
});
