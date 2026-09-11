import type {OnyxEntry} from 'react-native-onyx';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import type {DrinkingSession} from '@src/types/onyx';

type ColdStartLiveSessionParams = {
  /** The hydrated live-session buffer (`ONGOING_SESSION_DATA`). */
  ongoingSession: OnyxEntry<DrinkingSession>;

  /** The URL the app was launched with (`Linking.getInitialURL`), if any. */
  initialUrl: string | null;

  /** The route of the push notification that launched the app, if any. */
  initialNotificationRoute: Route | undefined;

  /** The route the navigator is on when the decision runs. */
  activeRoute: string;

  /** Whether the user still has onboarding ahead of them. */
  isOnboardingPending: boolean;
};

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const WEB_URL_PATTERN = /^https?:\/\//i;
const HOST_PATTERN = /^[^/?#]*/;
const QUERY_OR_HASH_PATTERN = /[?#].*$/;
const EDGE_SLASHES_PATTERN = /^\/+|\/+$/g;

/**
 * Reduce a URL or a route to a bare path: no scheme, no host (for web URLs),
 * no query, hash, or edge slashes. Parsed by hand because React Native's `URL`
 * doesn't implement `pathname`, and a failed parse must never read as "no deep
 * link".
 */
function toBarePath(urlOrRoute: string): string {
  let path = urlOrRoute.replace(SCHEME_PATTERN, '');
  if (WEB_URL_PATTERN.test(urlOrRoute)) {
    path = path.replace(HOST_PATTERN, '');
  }
  return path
    .replace(QUERY_OR_HASH_PATTERN, '')
    .replace(EDGE_SLASHES_PATTERN, '');
}

function isHomePath(path: string): boolean {
  return path === '' || path === ROUTES.HOME;
}

/**
 * Where a cold start should land when a live session is running: straight in
 * the live session screen, unless something more specific already claimed the
 * launch. A deep link or a tapped notification wins, onboarding wins, and so
 * does any route other than Home the navigator has already moved to. Returns
 * `null` when the app should stay where it is.
 */
function getColdStartLiveSessionRoute({
  ongoingSession,
  initialUrl,
  initialNotificationRoute,
  activeRoute,
  isOnboardingPending,
}: ColdStartLiveSessionParams): Route | null {
  if (!ongoingSession?.ongoing || !ongoingSession.id) {
    return null;
  }
  if (isOnboardingPending) {
    return null;
  }
  if (initialNotificationRoute) {
    return null;
  }
  if (initialUrl && !isHomePath(toBarePath(initialUrl))) {
    return null;
  }
  if (!isHomePath(toBarePath(activeRoute))) {
    return null;
  }
  return ROUTES.DRINKING_SESSION_LIVE.getRoute(ongoingSession.id);
}

export default getColdStartLiveSessionRoute;
export type {ColdStartLiveSessionParams};
