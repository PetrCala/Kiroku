import {getDefaultSessionName, getPartOfDay} from '@libs/SessionName';
import CONST from '@src/CONST';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const PRAGUE = 'Europe/Prague' as const;
const UTC = 'UTC' as SelectedTimezone;

describe('getPartOfDay', () => {
  it('splits the day at the configured hours', () => {
    const start = CONST.SESSION.PART_OF_DAY_START;
    expect(getPartOfDay(start.MORNING)).toBe('morning');
    expect(getPartOfDay(start.AFTERNOON - 1)).toBe('morning');
    expect(getPartOfDay(start.AFTERNOON)).toBe('afternoon');
    expect(getPartOfDay(start.EVENING - 1)).toBe('afternoon');
    expect(getPartOfDay(start.EVENING)).toBe('evening');
    expect(getPartOfDay(start.NIGHT - 1)).toBe('evening');
    expect(getPartOfDay(start.NIGHT)).toBe('night');
    expect(getPartOfDay(23)).toBe('night');
    expect(getPartOfDay(0)).toBe('night');
    expect(getPartOfDay(start.MORNING - 1)).toBe('night');
  });
});

describe('getDefaultSessionName', () => {
  // 2026-09-18 is a Friday. 19:00 UTC is 21:00 in Prague (CEST).
  const fridayEvening = Date.UTC(2026, 8, 18, 19, 0);

  it('names the session after its weekday and part of the day, in English', () => {
    expect(getDefaultSessionName(fridayEvening, PRAGUE, 'en')).toBe(
      'Friday evening',
    );
  });

  it('uses the Czech adjective form', () => {
    expect(getDefaultSessionName(fridayEvening, PRAGUE, 'cs_cz')).toBe(
      'Páteční večer',
    );
    expect(
      getDefaultSessionName(Date.UTC(2026, 8, 20, 8, 0), PRAGUE, 'cs_cz'),
    ).toBe('Nedělní ráno');
  });

  it('resolves the weekday and hour in the session timezone', () => {
    // 22:30 UTC on Friday is already Saturday 07:30 in Tokyo.
    const lateFridayUtc = Date.UTC(2026, 8, 18, 22, 30);
    expect(getDefaultSessionName(lateFridayUtc, 'Asia/Tokyo', 'en')).toBe(
      'Saturday morning',
    );
    expect(getDefaultSessionName(lateFridayUtc, UTC, 'en')).toBe(
      'Friday night',
    );
  });

  it('falls back to the default timezone without one', () => {
    expect(getDefaultSessionName(fridayEvening, undefined, 'en')).toMatch(
      /^Friday (evening|night)$/,
    );
  });
});
