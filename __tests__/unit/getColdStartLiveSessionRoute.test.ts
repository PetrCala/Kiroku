import getColdStartLiveSessionRoute from '@libs/Navigation/getColdStartLiveSessionRoute';
import type {ColdStartLiveSessionParams} from '@libs/Navigation/getColdStartLiveSessionRoute';
import ROUTES from '@src/ROUTES';
import type {DrinkingSession} from '@src/types/onyx';

const SESSION_ID = 'session-1';
const LIVE_ROUTE = ROUTES.DRINKING_SESSION_LIVE.getRoute(SESSION_ID);

const LIVE_SESSION = {
  id: SESSION_ID,
  ongoing: true,
  start_time: 1_700_000_000_000,
} as unknown as DrinkingSession;

function decide(
  overrides: Partial<ColdStartLiveSessionParams> = {},
): ReturnType<typeof getColdStartLiveSessionRoute> {
  return getColdStartLiveSessionRoute({
    ongoingSession: LIVE_SESSION,
    initialUrl: null,
    initialNotificationRoute: undefined,
    activeRoute: '/home',
    isOnboardingPending: false,
    ...overrides,
  });
}

describe('getColdStartLiveSessionRoute', () => {
  describe('live session', () => {
    test('present: opens the live session screen', () => {
      expect(decide()).toBe(LIVE_ROUTE);
    });

    test('absent: stays put', () => {
      expect(decide({ongoingSession: undefined})).toBeNull();
    });

    test('no longer ongoing: stays put', () => {
      expect(
        decide({ongoingSession: {...LIVE_SESSION, ongoing: false}}),
      ).toBeNull();
    });

    test('missing an id: stays put', () => {
      expect(
        decide({ongoingSession: {...LIVE_SESSION, id: undefined}}),
      ).toBeNull();
    });
  });

  describe('deep links win', () => {
    test.each<[string, string]>([
      ['universal link', 'https://kiroku.app/profile/user-2'],
      [
        'universal link with a query',
        'https://kiroku.app/friends?tab=requests',
      ],
      ['custom scheme', 'kiroku://profile/user-2'],
      [
        'custom scheme to another session',
        'kiroku://drinking-session/other/live',
      ],
    ])('%s: stays put', (_label, initialUrl) => {
      expect(decide({initialUrl})).toBeNull();
    });

    test.each<[string, string]>([
      ['bare origin', 'https://kiroku.app'],
      ['origin with a slash', 'https://kiroku.app/'],
      ['home path', 'https://kiroku.app/home'],
      ['bare custom scheme', 'kiroku://'],
      ['custom scheme home', 'kiroku://home'],
    ])(
      'a launch URL that only points at Home (%s) still opens it',
      (_label, initialUrl) => {
        expect(decide({initialUrl})).toBe(LIVE_ROUTE);
      },
    );

    test('a tapped notification wins', () => {
      expect(
        decide({initialNotificationRoute: ROUTES.SOCIAL_FRIEND_REQUESTS}),
      ).toBeNull();
    });
  });

  describe('onboarding', () => {
    test('not done: stays put so the onboarding guard can take over', () => {
      expect(decide({isOnboardingPending: true})).toBeNull();
    });
  });

  describe('active route', () => {
    test.each<[string, string]>([
      ['with a leading slash', '/home'],
      ['without a slash', 'home'],
      ['empty (navigator not settled yet)', ''],
    ])('Home %s: opens the live session', (_label, activeRoute) => {
      expect(decide({activeRoute})).toBe(LIVE_ROUTE);
    });

    test('already somewhere else: stays put', () => {
      expect(decide({activeRoute: '/profile/user-2'})).toBeNull();
    });
  });
});
