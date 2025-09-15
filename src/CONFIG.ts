import type {NativeConfig} from 'react-native-config';
import Config from 'react-native-config';
import CONST from './CONST';
import getPlatform from './libs/getPlatform';
import * as Url from './libs/Url';

// react-native-config doesn't trim whitespace on iOS for some reason so we
// add a trim() call to prevent headaches
const get = (config: NativeConfig, key: string, defaultValue: string): string =>
  (config?.[key] ?? defaultValue).trim();

// Set default values to contributor friendly values to make development work out of the box without an .env file
const ENVIRONMENT = get(Config, 'ENVIRONMENT', CONST.ENVIRONMENT.DEV);
const kirokuURL = Url.addTrailingForwardSlash(
  get(Config, 'KIROKU_URL', 'https://www.kiroku.com/'),
);
const stagingKirokuURL = Url.addTrailingForwardSlash(
  get(Config, 'STAGING_KIROKU_URL', 'https://staging.kiroku.com/'),
);
const stagingSecureKirokuUrl = Url.addTrailingForwardSlash(
  get(
    Config,
    'STAGING_SECURE_KIROKU_URL',
    'https://staging-secure.kiroku.com/',
  ),
);
const ngrokURL = Url.addTrailingForwardSlash(get(Config, 'NGROK_URL', ''));
const secureNgrokURL = Url.addTrailingForwardSlash(
  get(Config, 'SECURE_NGROK_URL', ''),
);
const secureKirokuUrl = Url.addTrailingForwardSlash(
  get(Config, 'SECURE_KIROKU_URL', 'https://secure.kiroku.com/'),
);
const useNgrok = get(Config, 'USE_NGROK', 'false') === 'true';
const useWebProxy = get(Config, 'USE_WEB_PROXY', 'true') === 'true';
// const kirokuComWithProxy = getPlatform() === 'web' && useWebProxy ? '/' : kirokuURL;
const kirokuComWithProxy = kirokuURL;

// Throw errors on dev if config variables are not set correctly
if (ENVIRONMENT === CONST.ENVIRONMENT.DEV) {
  if (
    !useNgrok &&
    kirokuURL.includes('dev') &&
    !secureKirokuUrl.includes('dev')
  ) {
    throw new Error(
      'SECURE_KIROKU_URL must end with .dev when KIROKU_URL ends with .dev',
    );
  }

  if (useNgrok && !secureNgrokURL) {
    throw new Error(
      'SECURE_NGROK_URL must be defined in .env when USE_NGROK=true',
    );
  }
}

const secureURLRoot =
  useNgrok && secureNgrokURL ? secureNgrokURL : secureKirokuUrl;

// Ngrok helps us avoid many of our cross-domain issues with connecting to our API
// and is required for viewing images on mobile and for developing on android
// To enable, set the USE_NGROK value to true in .env and update the NGROK_URL
const kirokuURLRoot = useNgrok && ngrokURL ? ngrokURL : kirokuComWithProxy;

const TEST_HOST = '127.0.0.1';
const TEST_AUTH_PORT = 9099;
const TEST_REALTIME_DATABASE_PORT = 9001;
const TEST_STORAGE_BUCKET_PORT = 9199;
const API_VERSION = get(Config, 'API_VERSION', 'v1');
const FUNCTIONS_REGION = get(Config, 'FUNCTIONS_REGION', 'europe-west1');
const FUNCTIONS_URL_OVERRIDE = get(Config, 'FUNCTIONS_URL', '');
const FUNCTIONS_EMULATOR_PORT = Number(get(Config, 'FUNCTIONS_PORT', '5001'));

export default {
  APP_NAME: 'kiroku',
  APP_NAME_VERBOSE: 'Kiroku',
  ENVIRONMENT,
  FIREBASE_CONFIG: {
    apiKey: get(Config, 'API_KEY', ''),
    authDomain: get(Config, 'AUTH_DOMAIN', ''),
    databaseURL: get(Config, 'DATABASE_URL', ''),
    projectId: get(Config, 'PROJECT_ID', ''),
    storageBucket: get(Config, 'STORAGE_BUCKET', ''),
    messagingSenderId: get(Config, 'MESSAGING_SENDER_ID', ''),
    appId: get(Config, 'APP_ID', ''),
    measurementId: get(Config, 'MEASUREMENT_ID', ''),
  },
  IS_IN_PRODUCTION: process.env.NODE_ENV === 'production' && !__DEV__,
  IS_IN_ADHOC: ENVIRONMENT === CONST.ENVIRONMENT.ADHOC,
  IS_IN_STAGING: ENVIRONMENT === CONST.ENVIRONMENT.STAGING,
  IS_IN_DEVELOPMENT: ENVIRONMENT === CONST.ENVIRONMENT.DEV,
  IS_IN_TEST:
    process.env.NODE_ENV === 'test' || ENVIRONMENT === CONST.ENVIRONMENT.TEST,
  IS_USING_WEB_PROXY: getPlatform() === CONST.PLATFORM.WEB && useWebProxy,
  IS_USING_LOCAL_WEB: false, // Disabled for now
  DEV_PORT: process.env.PORT ?? 8082,
  KIROKU: {
    // Note: This will be EXACTLY what is set for KIROKU_URL whether the proxy is enabled or not.
    KIROKU_URL: kirokuURL,
    SECURE_KIROKU_URL: secureKirokuUrl,

    // The DEFAULT API is the API used by most environments, except staging, where we use STAGING (defined below)
    // The "staging toggle" in settings toggles between DEFAULT and STAGING APIs
    // On both STAGING and PROD this (DEFAULT) address points to production
    // On DEV it can be configured through ENV settings and can be a proxy or ngrok address (defaults to PROD)
    // Usually you don't need to use this URL directly - prefer `ApiUtils.getApiRoot()`
    DEFAULT_API_ROOT: kirokuURLRoot,
    DEFAULT_SECURE_API_ROOT: secureURLRoot,
    STAGING_API_ROOT: stagingKirokuURL,
    STAGING_SECURE_API_ROOT: stagingSecureKirokuUrl,
  },
  PUSHER: {
    APP_KEY: get(Config, 'PUSHER_APP_KEY', ''),
    SUFFIX: get(Config, 'PUSHER_DEV_SUFFIX', ''),
    CLUSTER: 'mt1',
  },
  SEND_CRASH_REPORTS: get(Config, 'SEND_CRASH_REPORTS', 'false') === 'true',
  IS_USING_EMULATORS: get(Config, 'USE_EMULATORS', 'false') === 'true',
  TEST_PROJECT_ID: 'alcohol-tracker-db',
  SITE_TITLE: 'Kiroku',
  EMULATORS: {
    HOST: TEST_HOST,
    AUTH_URL: `http://${TEST_HOST}:${TEST_AUTH_PORT}`,
    AUTH_PORT: TEST_AUTH_PORT,
    DATABASE_PORT: TEST_REALTIME_DATABASE_PORT,
    STORAGE_BUCKET_PORT: TEST_STORAGE_BUCKET_PORT,
    FUNCTIONS_PORT: FUNCTIONS_EMULATOR_PORT,
  },
  API: {
    VERSION: API_VERSION,
  },
  FUNCTIONS: {
    REGION: FUNCTIONS_REGION,
    URL_OVERRIDE: FUNCTIONS_URL_OVERRIDE,
  },
} as const;
