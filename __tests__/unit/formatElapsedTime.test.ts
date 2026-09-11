import formatElapsedTime from '@libs/formatElapsedTime';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('formatElapsedTime', () => {
  test.each<[string, number, string]>([
    ['zero', 0, '0:00'],
    ['under a second rounds down', 999, '0:00'],
    ['seconds are zero-padded', 5 * SECOND, '0:05'],
    ['minutes are not padded under an hour', 1 * MINUTE + 5 * SECOND, '1:05'],
    ['just under an hour', HOUR - SECOND, '59:59'],
    ['exactly an hour switches to h:mm:ss', HOUR, '1:00:00'],
    [
      'minutes are padded once hours show',
      HOUR + 2 * MINUTE + 5 * SECOND,
      '1:02:05',
    ],
    ['hours keep counting past a day', 25 * HOUR, '25:00:00'],
  ])('%s', (_label, elapsedMs, expected) => {
    expect(formatElapsedTime(elapsedMs)).toBe(expected);
  });

  test('a start time in the future (clock skew) reads as zero', () => {
    expect(formatElapsedTime(-30 * SECOND)).toBe('0:00');
  });

  test('non-finite input reads as zero', () => {
    expect(formatElapsedTime(Number.NaN)).toBe('0:00');
    expect(formatElapsedTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});
