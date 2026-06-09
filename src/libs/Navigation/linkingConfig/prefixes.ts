import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '@navigation/types';
import CONST from '@src/CONST';

/**
 * URL prefixes that React Navigation strips before resolving a path to a screen.
 *
 * On native these are matched against incoming deep-link URLs (`extractPathFromURL`).
 * On web, React Navigation reads `window.location` directly and ignores this list,
 * but we keep the web origins here so the config documents every surface the app is
 * reachable from and so any full-URL resolution stays consistent across platforms.
 */
const prefixes: LinkingOptions<RootStackParamList>['prefixes'] = [
  // Native deep-link schemes. `app://-/` is the historical scheme inherited from the
  // upstream template; `kiroku://` (CONST.DEEPLINK_BASE_URL) is the scheme registered in
  // the iOS Info.plist and AndroidManifest.
  'app://-/',
  CONST.DEEPLINK_BASE_URL,

  // Web origins. Production lives at https://app.kiroku.cz; the dev server serves on
  // http://localhost:8082 (see config/webpack/webpack.dev.ts BASE_PORT).
  'https://app.kiroku.cz',
  'http://localhost:8082',
];

export default prefixes;
