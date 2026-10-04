// Making an exception to this rule here since we don't need an "action" for Log and Log should just be used directly. Creating a Log
// action would likely cause confusion about which one to use. But most other API methods should happen inside an action file.

/* eslint-disable rulesdir/no-api-in-views */
import Onyx from 'react-native-onyx';
import type {Merge} from 'type-fest';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import Logger from './common/Logger';
import pkg from '../../package.json';
import {addLog, flushAllLogsOnAppLaunch} from './actions/Console';
import {shouldAttachLog} from './Console';
import FirebaseCrashlytics from './Firebase/FirebaseCrashlytics';
import type {CrashlyticsAttributes} from './Firebase/FirebaseCrashlyticsTypes';
import getPlatform from './getPlatform';

let timeout: ReturnType<typeof setTimeout>;
let shouldCollectLogs = false;

// Levels that are worth waking someone up for. `Logger.add` prefixes every line
// it hands to the client callback, so the prefix is the only severity signal
// this callback gets.
const SURFACED_LEVEL_PREFIXES = ['[alrt]', '[warn]'];

// `babel-plugin-transform-remove-console` deletes every `console.debug` from a
// release bundle (see `babel.config.js`), and this callback is the only client
// sink there is: `LogCommand` below is a stub that never posts. So on an ad-hoc
// test build `Log.alert` has been writing into nothing, and the only way to read
// a startup alert was Crashlytics or a locally patched build.
//
// Ad-hoc builds exist to be debugged, so let the two loud levels through there on
// `console.warn`, which the babel plugin keeps. Everything quieter stays on
// `console.debug`, so a test build's log volume, and its performance, still
// resemble production. `CONFIG.IS_IN_ADHOC` is read from the bundled env file, so
// this costs one boolean and pulls nothing new onto the launch path; deciding it
// from `getEnvironment()` instead would drag `betaChecker` (and, on Android,
// Onyx and `actions/AppUpdate`) into Log's import graph.
function writeToConsole(message: string, extraData: unknown): void {
  if (
    CONFIG.IS_IN_ADHOC &&
    SURFACED_LEVEL_PREFIXES.some(prefix => message.startsWith(prefix))
  ) {
    // eslint-disable-next-line no-console
    console.warn(message, extraData);
    return;
  }
  console.debug(message, extraData);
}

type AlertParameters = Parameters<Logger['alert']>[1];

// An alert's context is a code or a one-line message. A longer string is a
// payload, and only its head is worth a custom key.
const MAX_ATTRIBUTE_LENGTH = 200;

/**
 * The part of an alert's parameters that may leave the device as Crashlytics
 * custom keys. Alert parameters often hold whole payloads (an Apple sign-in
 * response, the request behind a failed API call), so only flat values cross
 * over, with strings and Errors cut short. Objects and arrays stay local, and
 * so does the call-site stack `Logger.alert` adds, which would only bury the
 * keys worth reading.
 */
function toCrashlyticsAttributes(
  parameters: AlertParameters,
): CrashlyticsAttributes {
  if (parameters instanceof Error) {
    return {error: String(parameters).slice(0, MAX_ATTRIBUTE_LENGTH)};
  }
  if (typeof parameters !== 'object' || Array.isArray(parameters)) {
    return {};
  }
  const attributes: CrashlyticsAttributes = {};
  Object.entries(parameters).forEach(([key, value]) => {
    if (key === 'stack') {
      return;
    }
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    ) {
      attributes[key] = value;
    } else if (typeof value === 'string' || value instanceof Error) {
      attributes[key] = String(value).slice(0, MAX_ATTRIBUTE_LENGTH);
    }
  });
  return attributes;
}

// Crashlytics keeps only the last eight non-fatals of a session. An alert on a
// hot path (a missing translation in a list row) would push every other report
// out, at one native call per render, so an identical alert is reported once
// per launch.
const reportedAlerts = new Set<string>();

/**
 * Mirror an alert into Crashlytics as a non-fatal named after its message.
 * Nothing else carries an alert out of a release build: the console line is
 * stripped and `LogCommand` below never posts. `recordNonFatal` applies the
 * `SEND_CRASH_REPORTS` build flag and the user's crash-reporting preference,
 * and is a no-op on web.
 */
function reportAlertToCrashlytics(
  message: string,
  parameters: AlertParameters,
): void {
  const attributes = toCrashlyticsAttributes(parameters);
  const signature = `${message} ${JSON.stringify(attributes)}`;
  if (reportedAlerts.has(signature)) {
    return;
  }
  reportedAlerts.add(signature);
  FirebaseCrashlytics.recordNonFatal(message, attributes);
}

Onyx.connect({
  key: ONYXKEYS.SHOULD_STORE_LOGS,
  callback: val => {
    if (!val) {
      shouldCollectLogs = false;
    }

    shouldCollectLogs = !!val;
  },
});

type LogCommandParameters = {
  kirokuAppVersion: string;
  logPacket: string;
};

function LogCommand(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parameters: LogCommandParameters,
): Promise<{requestID: string}> {
  //   const commandName = 'Log';
  // requireParameters(
  //   ['logPacket', 'kirokuAppVersion'],
  //   parameters,
  //   commandName,
  // );

  // Note: We are forcing Log to run since it requires no authToken and should only be queued when we are offline.
  // Non-cancellable request: during logout, when requests are cancelled, we don't want to cancel any remaining logs
  // return Network.post(commandName, {
  //   ...parameters,
  //   forceNetworkRequest: true,
  //   canCancel: false,
  // }) as Promise<{requestID: string}>;
  // }
  // TODO: Implement this
  return Promise.resolve({requestID: 'xxx'}) as Promise<{requestID: string}>;
}

// eslint-disable-next-line
type ServerLoggingCallbackOptions = {api_setCookie: boolean; logPacket: string};
type RequestParams = Merge<
  ServerLoggingCallbackOptions,
  {
    shouldProcessImmediately: boolean;
    shouldRetry: boolean;
    kirokuAppVersion: string;
    parameters: string;
  }
>;

/**
 * (Re)arm the 10-minute log-flush timer. The handle is unref'd so it never
 * holds a Node process (Jest) open; React Native timers have no unref, hence
 * the optional call.
 */
function scheduleLogFlush(logger: Logger): void {
  clearTimeout(timeout);
  timeout = setTimeout(
    () => logger.info('Flushing logs older than 10 minutes', true, {}, true),
    10 * 60 * 1000,
  );
  (timeout as unknown as {unref?: () => void}).unref?.();
}

/**
 * Network interface for logger.
 */
function serverLoggingCallback(
  logger: Logger,
  params: ServerLoggingCallbackOptions,
): Promise<{requestID: string}> {
  const requestParams = params as RequestParams;
  requestParams.shouldProcessImmediately = false;
  requestParams.shouldRetry = false;
  requestParams.kirokuAppVersion = `kiroku[${getPlatform()}]${pkg.version}`;
  if (requestParams.parameters) {
    requestParams.parameters = JSON.stringify(requestParams.parameters);
  }
  scheduleLogFlush(logger);
  return LogCommand(requestParams);
}

// Note: We are importing Logger from expensify-common because it is used by other platforms. The server and client logging
// callback methods are passed in here so we can decouple the logging library from the logging methods.
const Log = new Logger({
  serverLoggingCallback,
  clientLoggingCallback: (message, extraData) => {
    if (!shouldAttachLog(message)) {
      return;
    }

    flushAllLogsOnAppLaunch().then(() => {
      writeToConsole(message, extraData);
      if (shouldCollectLogs) {
        addLog({
          time: new Date(),
          level: CONST.DEBUG_CONSOLE.LEVELS.DEBUG,
          message,
          extraData,
        });
      }
    });
  },
  isDebug: true,
});

// The client callback above only sees the formatted line (`[alrt] message -
// {json}`), which is no use as an issue name. Wrapping `alert` hands Crashlytics
// the bare message and the parameters while both are still separate.
const logAlert = Log.alert.bind(Log);
Log.alert = (message, parameters = {}, includeStackTrace = true) => {
  logAlert(message, parameters, includeStackTrace);
  reportAlertToCrashlytics(message, parameters);
};
scheduleLogFlush(Log);

export default Log;
