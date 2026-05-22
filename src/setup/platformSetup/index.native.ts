import {
  getCrashlytics,
  log,
  recordError,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';
import {getPerformance} from '@react-native-firebase/perf';
import CONFIG from '@src/CONFIG';

 

// Forwards uncaught JS errors to Crashlytics' log buffer before the default
// handler runs. Worklet/Reanimated errors surface here as fatal JSErrors that
// otherwise crash the process with only a `facebook::jsi::JSError` type tag
// in Crashlytics — no message, no stack. Logging into the buffer first means
// the message + stack land in the Crashlytics "Logs" tab on the next crash.
function installCrashlyticsJSErrorBridge() {
  const errorUtils = (
    global as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
        setGlobalHandler: (
          handler: (error: Error, isFatal?: boolean) => void,
        ) => void;
      };
    }
  ).ErrorUtils;
  if (!errorUtils) {
    return;
  }
  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const crashlytics = getCrashlytics();
      const name = error?.name ?? 'Error';
      const message = error?.message ?? String(error);
      log(
        crashlytics,
        `[JS ${isFatal ? 'FATAL' : 'soft'}] ${name}: ${message}`,
      );
      const stack = error?.stack;
      if (stack) {
        log(crashlytics, stack.split('\n').slice(0, 30).join('\n'));
      }
      if (error instanceof Error) {
        recordError(crashlytics, error);
      }
    } catch {
      // Never let the bridge itself throw — fall through to the default handler.
    }
    previousHandler?.(error, isFatal);
  });
}

export default function () {
  if (!CONFIG.SEND_CRASH_REPORTS) {
    setCrashlyticsCollectionEnabled(getCrashlytics(), false);
    getPerformance().dataCollectionEnabled = false;
    return;
  }
  installCrashlyticsJSErrorBridge();
}
