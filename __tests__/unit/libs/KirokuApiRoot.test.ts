/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * Play internal-track (staging) builds are the production flavor with the prod
 * Firebase config baked in at build time; they merely runtime-classify as
 * STAGING via the beta checker (installed version > latest GitHub release). If
 * the kiroku-api root followed that classification to the dev API, the
 * prod-issued Firebase ID token would get a 401 and trigger an instant
 * sign-out, bouncing every login on a staging build back to the sign-in
 * screen. These tests pin the root selection per environment:
 * prod + staging → prod API; dev/adhoc (which bake the dev Firebase project)
 * → dev API.
 */
import type * as ApiUtilsType from '@libs/ApiUtils';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {connect: jest.fn(), disconnect: jest.fn()},
}));

// ApiUtils resolves the environment once at import; make it controllable.
let mockEnvironment: string;
jest.mock('@libs/Environment/Environment', () => ({
  getEnvironment: jest.fn(() => Promise.resolve(mockEnvironment)),
}));

/**
 * Load a fresh ApiUtils under the given environment. The env name is applied
 * through a module-scope promise at import, so flush microtasks before reading
 * the selected root.
 */
async function getKirokuApiRootFor(environment: string): Promise<string> {
  mockEnvironment = environment;
  jest.resetModules();
  const ApiUtils = require('@libs/ApiUtils') as typeof ApiUtilsType;
  await Promise.resolve();
  await Promise.resolve();
  return ApiUtils.getKirokuApiRoot();
}

describe('ApiUtils.getKirokuApiRoot environment selection', () => {
  it.each([
    [CONST.ENVIRONMENT.PROD, CONFIG.KIROKU_API.PROD_ROOT],
    [CONST.ENVIRONMENT.STAGING, CONFIG.KIROKU_API.PROD_ROOT],
    [CONST.ENVIRONMENT.DEV, CONFIG.KIROKU_API.DEV_ROOT],
    [CONST.ENVIRONMENT.ADHOC, CONFIG.KIROKU_API.DEV_ROOT],
  ])('%s builds use %s', async (environment, expectedRoot) => {
    await expect(getKirokuApiRootFor(environment)).resolves.toBe(expectedRoot);
  });
});
