import type {ValueOf} from 'type-fest';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import * as Environment from './Environment/Environment';

// Native apps use the production config for both staging and prod builds.
// The async environment check works on all platforms.
let ENV_NAME: ValueOf<typeof CONST.ENVIRONMENT> = CONST.ENVIRONMENT.PROD;
Environment.getEnvironment().then(envName => {
  ENV_NAME = envName;
});

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

/**
 * Which kiroku-api backend this build talks to, in the watch credential
 * bridge's vocabulary. Same PROD/STAGING-to-prod rule as `getKirokuApiRoot` so
 * the watch always hits the same backend as the phone.
 */
function getKirokuApiEnv(): 'dev' | 'prod' {
  return ENV_NAME === CONST.ENVIRONMENT.PROD ||
    ENV_NAME === CONST.ENVIRONMENT.STAGING
    ? 'prod'
    : 'dev';
}

export {getKirokuApiEnv, getKirokuApiRoot};
