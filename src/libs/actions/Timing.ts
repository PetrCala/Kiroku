import * as Environment from '@libs/Environment/Environment';
import FirebasePerformance from '@libs/Firebase/FirebasePerformance';
import Log from '@libs/Log';

type TimestampData = {
  startTime: number;
};

let timestampData: Record<string, TimestampData> = {};

/**
 * Start a performance timing measurement and open a Firebase Performance trace.
 */
function start(eventName: string) {
  void FirebasePerformance.startTrace(eventName);
  timestampData[eventName] = {startTime: performance.now()};
}

/**
 * End a performance timing measurement. Stops the Firebase trace and logs
 * elapsed time to the console. Warns if maxExecutionTime is exceeded.
 */
function end(eventName: string, secondaryName = '', maxExecutionTime = 0) {
  if (!timestampData[eventName]) {
    return;
  }

  const {startTime} = timestampData[eventName];
  const eventTime = performance.now() - startTime;

  void FirebasePerformance.stopTrace(eventName);

  Environment.getEnvironment().then(envName => {
    const baseEventName = `${envName}.kiroku.${eventName}`;
    const grafanaEventName = secondaryName
      ? `${baseEventName}.${secondaryName}`
      : baseEventName;

    console.debug(`Timing:${grafanaEventName}`, eventTime);
    delete timestampData[eventName];

    if (Environment.isDevelopment()) {
      return;
    }

    if (maxExecutionTime && eventTime > maxExecutionTime) {
      Log.warn(
        `${eventName} exceeded max execution time of ${maxExecutionTime}.`,
        {eventTime, eventName},
      );
    }
  });
}

/**
 * Clears all timing data.
 */
function clearData() {
  timestampData = {};
}

export default {
  start,
  end,
  clearData,
};
