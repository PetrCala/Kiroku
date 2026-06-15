import {
  selectHasEverLogged,
  selectIsSparse,
} from '@libs/Statistics/overviewSelectors';
import type {DrinkEvent} from '@libs/Statistics/types';

function event(overrides: Partial<DrinkEvent>): DrinkEvent {
  const ts = overrides.ts ?? new Date('2026-05-25T12:00:00Z').getTime();
  return {
    userId: 'u1',
    sessionId: 's-default',
    ts,
    anchorTs: ts,
    localDay: '2026-05-25',
    localIsoWeek: '2026-W22',
    localMonth: '2026-05',
    localHour: 12,
    localDow: 0,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units: 1,
    blackoutSession: false,
    ...overrides,
  };
}

describe('selectIsSparse / selectHasEverLogged', () => {
  it('treats <4 weeks of data as sparse', () => {
    expect(selectIsSparse([event({})], 3)).toBe(true);
    expect(selectIsSparse([event({})], 4)).toBe(false);
  });

  it('treats zero events as sparse regardless of weeks count', () => {
    expect(selectIsSparse([], 10)).toBe(true);
  });

  it('hasEverLogged flips on the first event', () => {
    expect(selectHasEverLogged([])).toBe(false);
    expect(selectHasEverLogged([event({})])).toBe(true);
  });
});
