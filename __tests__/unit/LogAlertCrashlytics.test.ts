/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import type FirebaseCrashlyticsType from '@libs/Firebase/FirebaseCrashlytics';
import type LogType from '@libs/Log';

/**
 * A release bundle strips the console line and `LogCommand` never posts, so
 * Crashlytics is the only place an alert can be read from the field. These pin
 * down what crosses over: the bare message as the issue name, flat parameters
 * as custom keys, and nothing that could be a payload.
 */
jest.mock('@libs/Firebase/FirebaseCrashlytics', () => ({
  __esModule: true,
  default: {recordNonFatal: jest.fn()},
}));

jest.mock('@libs/actions/Console', () => ({
  addLog: jest.fn(),
  flushAllLogsOnAppLaunch: () => Promise.resolve(),
}));

// Each load gets its own "reported once per launch" memory, like a cold start.
function loadLog(): {
  Log: typeof LogType;
  recordNonFatal: jest.Mock;
} {
  let log: typeof LogType | undefined;
  let crashlytics: typeof FirebaseCrashlyticsType | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require, @typescript-eslint/no-require-imports */
    log = (require('@libs/Log') as {default: typeof LogType}).default;
    crashlytics = (
      require('@libs/Firebase/FirebaseCrashlytics') as {
        default: typeof FirebaseCrashlyticsType;
      }
    ).default;
    /* eslint-enable global-require, @typescript-eslint/no-require-imports */
  });
  if (!log || !crashlytics) {
    throw new Error('Log did not load');
  }
  return {
    Log: log,
    recordNonFatal: crashlytics.recordNonFatal as jest.Mock,
  };
}

const SEND_FAILED = '[sendVerifyEmailLink] failed to send verification email';

describe('Log.alert Crashlytics mirror', () => {
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('records an alert as a non-fatal named after its message, with the code as a key', () => {
    const {Log, recordNonFatal} = loadLog();

    Log.alert(SEND_FAILED, {
      code: 'auth/quota-exceeded',
      message: 'Firebase: Error (auth/quota-exceeded).',
    });

    // Exact match: the call-site stack `Logger.alert` adds must not ride along.
    expect(recordNonFatal).toHaveBeenCalledTimes(1);
    expect(recordNonFatal).toHaveBeenCalledWith(SEND_FAILED, {
      code: 'auth/quota-exceeded',
      message: 'Firebase: Error (auth/quota-exceeded).',
    });
  });

  it('keeps objects and arrays on the device', () => {
    const {Log, recordNonFatal} = loadLog();

    Log.alert(
      '[Apple Sign In] Authentication failed',
      {
        response: {identityToken: 'secret', email: 'jane@example.com'},
        chunks: ['a', 'b'],
        timeoutMs: 3000,
        isAuthDataReady: false,
      },
      false,
    );

    expect(recordNonFatal).toHaveBeenCalledWith(
      '[Apple Sign In] Authentication failed',
      {timeoutMs: 3000, isAuthDataReady: false},
    );
  });

  it('stringifies errors and cuts long strings short', () => {
    const {Log, recordNonFatal} = loadLog();

    Log.alert(
      '[Pusher] Unable to parse single JSON event data from Pusher',
      {
        error: new SyntaxError('Unexpected token <'),
        eventData: 'x'.repeat(500),
      },
      false,
    );

    expect(recordNonFatal).toHaveBeenCalledWith(
      '[Pusher] Unable to parse single JSON event data from Pusher',
      {
        error: 'SyntaxError: Unexpected token <',
        eventData: 'x'.repeat(200),
      },
    );
  });

  it('reports an identical alert once per launch, so a hot path cannot evict the rest', () => {
    const {Log, recordNonFatal} = loadLog();

    Log.alert('some.key was not found in the en locale');
    Log.alert('some.key was not found in the en locale');
    Log.alert('some.key was not found in the en locale');

    expect(recordNonFatal).toHaveBeenCalledTimes(1);
  });

  it('reports the same alert again when its context differs', () => {
    const {Log, recordNonFatal} = loadLog();

    Log.alert(SEND_FAILED, {code: 'auth/quota-exceeded'}, false);
    Log.alert(SEND_FAILED, {code: 'auth/too-many-requests'}, false);

    expect(recordNonFatal).toHaveBeenCalledTimes(2);
    expect(recordNonFatal).toHaveBeenLastCalledWith(SEND_FAILED, {
      code: 'auth/too-many-requests',
    });
  });

  it('leaves the quieter levels out', () => {
    const {Log, recordNonFatal} = loadLog();

    Log.info('routine startup chatter');
    Log.hmmm('something mildly odd');
    Log.warn('a warning');

    expect(recordNonFatal).not.toHaveBeenCalled();
  });
});
