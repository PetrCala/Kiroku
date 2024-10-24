import Config from 'react-native-config';
import CONST from '@src/CONST';
import getEnvironment from './getEnvironment';
import CONFIG from '@src/CONFIG';

const ENVIRONMENT_URLS = {
  [CONST.ENVIRONMENT.DEV]: CONST.APP_URLS.DEV + CONFIG.DEV_PORT,
  [CONST.ENVIRONMENT.STAGING]: CONST.APP_URLS.STAGING,
  [CONST.ENVIRONMENT.PROD]: CONST.KIROKU_URL,
  [CONST.ENVIRONMENT.ADHOC]: CONST.APP_URLS.ADHOC,
  [CONST.ENVIRONMENT.TEST]: CONST.APP_URLS.TEST,
};

/**
 * Are we running the app in development?
 */
function isDevelopment(): boolean {
  return (
    (Config?.ENVIRONMENT ?? CONST.ENVIRONMENT.DEV) === CONST.ENVIRONMENT.DEV
  );
}

/**
 * Are we running the app in production?
 */
function isProduction(): Promise<boolean> {
  return getEnvironment().then(
    environment => environment === CONST.ENVIRONMENT.PROD,
  );
}

/**
 * Are we running an internal test build?
 */
function isInternalTestBuild(): boolean {
  return !!(
    (Config?.ENVIRONMENT ?? CONST.ENVIRONMENT.DEV) ===
      CONST.ENVIRONMENT.ADHOC &&
    (Config?.PULL_REQUEST_NUMBER ?? '')
  );
}

/**
 * Get the URL based on the environment we are in
 */
function getEnvironmentURL(): Promise<string> {
  return new Promise(resolve => {
    getEnvironment().then(environment =>
      resolve(ENVIRONMENT_URLS[environment]),
    );
  });
}

export {
  getEnvironment,
  isInternalTestBuild,
  isDevelopment,
  isProduction,
  getEnvironmentURL,
};
