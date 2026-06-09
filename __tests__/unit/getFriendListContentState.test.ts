import getFriendListContentState from '@screens/Social/getFriendListContentState';

describe('getFriendListContentState', () => {
  describe('unresolved list (no friends known yet, bootstrap not complete)', () => {
    // `isLoadingApp` is `undefined` before the first openApp optimistic write
    // and `true` while openApp is in flight — both mean "bootstrap not done".
    test.each<[string, boolean | undefined]>([
      ['isLoadingApp undefined', undefined],
      ['isLoadingApp true', true],
    ])('online → loading (%s)', (_label, isLoadingApp) => {
      expect(getFriendListContentState(0, isLoadingApp, false)).toBe('loading');
    });

    test.each<[string, boolean | undefined]>([
      ['isLoadingApp undefined', undefined],
      ['isLoadingApp true', true],
    ])('offline → offlineUnavailable (%s)', (_label, isLoadingApp) => {
      expect(getFriendListContentState(0, isLoadingApp, true)).toBe(
        'offlineUnavailable',
      );
    });
  });

  describe('resolved list (bootstrap complete)', () => {
    test('no friends → empty (online)', () => {
      expect(getFriendListContentState(0, false, false)).toBe('empty');
    });

    test('no friends → empty even when offline (warm cache confirmed none)', () => {
      // Resolved-empty is authoritative regardless of network: a user the cache
      // says has no friends sees the welcome state, not the offline notice.
      expect(getFriendListContentState(0, false, true)).toBe('empty');
    });
  });

  describe('has friends (data is authoritative regardless of bootstrap/network)', () => {
    test.each<[string, boolean | undefined, boolean]>([
      ['online, bootstrap done', false, false],
      ['offline warm cache', false, true],
      ['offline mid-bootstrap (cached)', true, true],
      ['online mid-bootstrap (cached)', undefined, false],
    ])('→ data (%s)', (_label, isLoadingApp, isOffline) => {
      expect(getFriendListContentState(3, isLoadingApp, isOffline)).toBe(
        'data',
      );
    });
  });
});
