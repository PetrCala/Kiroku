import {
  findFocusedRoute,
  getPathFromState,
  getStateFromPath,
} from '@react-navigation/native';
import config from '@libs/Navigation/linkingConfig/config';
import prefixes from '@libs/Navigation/linkingConfig/prefixes';
import CONST from '@src/CONST';
import SCREENS from '@src/SCREENS';

/**
 * These tests pin the browser-URL <-> screen mapping that powers web linking
 * (epic #925, issue #933). They exercise the same `getStateFromPath` /
 * `getPathFromState` pair React Navigation uses on web to resolve a shareable
 * URL into navigation state and to serialize state back into the address bar.
 */

type RouteCase = {
  /** Path as it appears in the browser address bar (no leading slash). */
  path: string;
  /** Screen the URL should focus. */
  screen: string;
  /** Params expected on the focused route, if the route is parameterized. */
  params?: Record<string, string>;
};

const ROUTE_CASES: RouteCase[] = [
  {path: 'home', screen: SCREENS.HOME},
  {path: 'statistics', screen: SCREENS.STATISTICS.ROOT},
  {path: 'settings/preferences', screen: SCREENS.SETTINGS.PREFERENCES.ROOT},
  {path: 'badges', screen: SCREENS.BADGES.ROOT},
  {path: 'profile/123', screen: SCREENS.PROFILE.ROOT, params: {userID: '123'}},
  {
    path: 'day-overview/123/2024-01-15',
    screen: SCREENS.DAY_OVERVIEW.ROOT,
    params: {userID: '123', date: '2024-01-15'},
  },
  {
    path: 'drinking-session/abc/edit',
    screen: SCREENS.DRINKING_SESSION.EDIT,
    params: {sessionId: 'abc'},
  },
];

describe('linkingConfig prefixes', () => {
  it('keeps the native deep-link schemes', () => {
    expect(prefixes).toContain('app://-/');
    expect(prefixes).toContain(CONST.DEEPLINK_BASE_URL);
  });

  it('adds the web origins (production + local dev server)', () => {
    expect(prefixes).toContain('https://app.kiroku.cz');
    expect(prefixes).toContain('http://localhost:8082');
  });
});

describe('linkingConfig route resolution (getStateFromPath)', () => {
  it.each(ROUTE_CASES)(
    'resolves /$path to the $screen screen',
    ({path, screen, params}) => {
      const state = getStateFromPath(path, config);
      if (!state) {
        throw new Error(`Expected /${path} to resolve to a navigation state`);
      }

      const focused = findFocusedRoute(state);
      expect(focused?.name).toBe(screen);

      if (params) {
        expect(focused?.params).toMatchObject(params);
      }
    },
  );
});

describe('linkingConfig path serialization (getPathFromState)', () => {
  it.each(ROUTE_CASES)(
    'serializes the $screen screen back to /$path',
    ({path}) => {
      const state = getStateFromPath(path, config);
      if (!state) {
        throw new Error(`Expected /${path} to resolve to a navigation state`);
      }

      // The browser address bar is always rooted at "/", so the round-trip
      // adds the leading slash back onto the canonical path.
      expect(getPathFromState(state, config)).toBe(`/${path}`);
    },
  );
});
