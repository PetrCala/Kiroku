import Onyx from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Request} from '@src/types/onyx';
import proxyConfig from '../../config/proxyConfig';
import * as Environment from './Environment/Environment';

// To avoid rebuilding native apps, native apps use production config for both staging and prod
// We use the async environment check because it works on all platforms
let ENV_NAME: ValueOf<typeof CONST.ENVIRONMENT> = CONST.ENVIRONMENT.PROD;
let shouldUseStagingServer = false;
Environment.getEnvironment().then(envName => {
  ENV_NAME = envName;

  // We connect here, so we have the updated ENV_NAME when Onyx callback runs
  Onyx.connect({
    key: ONYXKEYS.USER,
    callback: value => {
      // Toggling between APIs is not allowed on production and internal dev environment
      if (ENV_NAME === CONST.ENVIRONMENT.PROD || CONFIG.IS_USING_LOCAL_WEB) {
        shouldUseStagingServer = false;
        return;
      }

      const defaultToggleState =
        ENV_NAME === CONST.ENVIRONMENT.STAGING ||
        ENV_NAME === CONST.ENVIRONMENT.ADHOC;
      shouldUseStagingServer =
        value?.shouldUseStagingServer ?? defaultToggleState;
    },
  });
});

/**
 * Get the currently used API endpoint
 * (Non-production environments allow for dynamically switching the API)
 */
function getApiRoot(request?: Request): string {
  const shouldUseSecure = request?.shouldUseSecure ?? false;

  if (shouldUseStagingServer) {
    if (CONFIG.IS_USING_WEB_PROXY && !request?.shouldSkipWebProxy) {
      return shouldUseSecure ? proxyConfig.STAGING_SECURE : proxyConfig.STAGING;
    }
    return shouldUseSecure
      ? CONFIG.KIROKU.STAGING_SECURE_API_ROOT
      : CONFIG.KIROKU.STAGING_API_ROOT;
  }
  if (request?.shouldSkipWebProxy) {
    return shouldUseSecure
      ? CONFIG.KIROKU.SECURE_KIROKU_URL
      : CONFIG.KIROKU.KIROKU_URL;
  }
  return shouldUseSecure
    ? CONFIG.KIROKU.DEFAULT_SECURE_API_ROOT
    : CONFIG.KIROKU.DEFAULT_API_ROOT;
}

/**
 * Get the command url for the given request
 * @param - the name of the API command
 */
function getCommandURL(request: Request): string {
  // If request.command already contains ? then we don't need to append it
  return `${getApiRoot(request)}api/${request.command}${request.command.includes('?') ? '' : '?'}`;
}

/**
 * Check if we're currently using the staging API root
 */
function isUsingStagingApi(): boolean {
  return shouldUseStagingServer;
}

/**
 * Base URL for the kiroku-api HTTPS function, selected by environment. Prod
 * and staging builds hit the prod project; dev/adhoc builds hit dev.
 * Route paths (see `libs/API/kirokuRoutes.ts`) include the `/v1` prefix and are
 * appended to this root.
 */
function getKirokuApiRoot(): string {
  // Staging builds carry the production Firebase config baked in at build time
  // (a Play internal-track build is the production flavor that merely
  // runtime-classifies as STAGING via the beta checker), so they must talk to
  // the prod API: a prod-issued ID token gets a 401 from the dev API, which
  // triggers an immediate sign-out. Only dev/adhoc builds, whose env files
  // bake the dev Firebase project, use the dev root.
  const root =
    ENV_NAME === CONST.ENVIRONMENT.PROD ||
    ENV_NAME === CONST.ENVIRONMENT.STAGING
      ? CONFIG.KIROKU_API.PROD_ROOT
      : CONFIG.KIROKU_API.DEV_ROOT;
  return root.replace(/\/+$/, '');
}

export {getApiRoot, getCommandURL, getKirokuApiRoot, isUsingStagingApi};
