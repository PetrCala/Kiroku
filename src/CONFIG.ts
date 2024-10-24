import type {NativeConfig} from 'react-native-config';
import Config from 'react-native-config';
import CONST from './CONST';
import getPlatform from '@libs/getPlatform';

// react-native-config doesn't trim whitespace on iOS for some reason so we
// add a trim() call to prevent headaches
const get = (config: NativeConfig, key: string, defaultValue: string): string =>
  (config?.[key] ?? defaultValue).trim();

const useWebProxy = get(Config, 'USE_WEB_PROXY', 'true') === 'true';

// Set default values to contributor friendly values to make development work out of the box without an .env file
const ENVIRONMENT = get(Config, 'ENVIRONMENT', CONST.ENVIRONMENT.DEV);

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
    DEFAULT_API_ROOT: '',
    DEFAULT_SECURE_API_ROOT: '',
    STAGING_SECURE_API_ROOT: '',
    STAGING_API_ROOT: '',
    KIROKU_URL: '',
  },
  PUSHER: {
    APP_KEY: get(Config, 'PUSHER_APP_KEY', ''),
    SUFFIX: get(Config, 'PUSHER_DEV_SUFFIX', ''),
    CLUSTER: 'mt1',
  },
  SEND_CRASH_REPORTS: get(Config, 'SEND_CRASH_REPORTS', 'false') === 'true',
  IS_USING_EMULATORS: get(Config, 'USE_EMULATORS', 'false') === 'true',
  TEST_PROJECT_ID: 'alcohol-tracker-db',
  TEST_HOST: 'localhost',
  TEST_AUTH_PORT: 9099,
  TEST_REALTIME_DATABASE_PORT: 9001,
  TEST_STORAGE_BUCKET_PORT: 9199,
  SITE_TITLE: 'Kiroku',
} as const;
