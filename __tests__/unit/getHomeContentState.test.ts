import getHomeContentState from '@screens/getHomeContentState';
import type {DrinkingSessionList, Preferences} from '@src/types/onyx';

const PREFS = {} as unknown as Preferences;
const EMPTY_SESSIONS: DrinkingSessionList = {};
// `getHomeContentState` only checks emptiness, so a single keyed entry is all a
// "has sessions" fixture needs — its contents are irrelevant.
const SOME_SESSIONS = {s1: {}} as unknown as DrinkingSessionList;

describe('getHomeContentState', () => {
  describe('unresolved snapshot (preferences or sessions still undefined)', () => {
    test.each<
      [string, Preferences | undefined, DrinkingSessionList | undefined]
    >([
      ['both undefined', undefined, undefined],
      ['preferences resolved, sessions undefined', PREFS, undefined],
      ['sessions resolved, preferences undefined', undefined, EMPTY_SESSIONS],
    ])('online → loading (%s)', (_label, prefs, sessions) => {
      expect(getHomeContentState(prefs, sessions, false)).toBe('loading');
    });

    test.each<
      [string, Preferences | undefined, DrinkingSessionList | undefined]
    >([
      ['both undefined', undefined, undefined],
      ['preferences resolved, sessions undefined', PREFS, undefined],
      ['sessions resolved, preferences undefined', undefined, EMPTY_SESSIONS],
    ])('offline → offlineUnavailable (%s)', (_label, prefs, sessions) => {
      expect(getHomeContentState(prefs, sessions, true)).toBe(
        'offlineUnavailable',
      );
    });
  });

  describe('resolved snapshot', () => {
    test('empty sessions → empty (online)', () => {
      expect(getHomeContentState(PREFS, EMPTY_SESSIONS, false)).toBe('empty');
    });

    test('empty sessions → empty even when offline (warm cache confirmed no sessions)', () => {
      // Resolved-empty is authoritative regardless of network: a user the cache
      // says has no sessions must see the welcome state, not the offline notice.
      expect(getHomeContentState(PREFS, EMPTY_SESSIONS, true)).toBe('empty');
    });

    test('populated sessions → data (online)', () => {
      expect(getHomeContentState(PREFS, SOME_SESSIONS, false)).toBe('data');
    });

    test('populated sessions → data when offline (warm cache)', () => {
      expect(getHomeContentState(PREFS, SOME_SESSIONS, true)).toBe('data');
    });
  });
});
