import performance, {PerformanceObserver} from 'react-native-performance';
import * as Environment from '@libs/Environment/Environment';
import type StartupMetrics from './types';

let initialized = false;

const STARTUP_MEASURES = [
  // OS process spawn → ContentProvider/AppDelegate first frame
  {name: 'nativeLaunch', start: 'nativeLaunchStart', end: 'nativeLaunchEnd'},
  // JS bundle parse + initial execution
  {name: 'runJsBundle', start: 'runJsBundleStart', end: 'runJsBundleEnd'},
  // Total cold start: process spawn → first content visible
  {name: 'appStartup', start: 'nativeLaunchStart', end: 'contentAppeared'},
] as const;

const startupMetrics: StartupMetrics = {
  init: () => {
    if (initialized) {
      return;
    }
    initialized = true;

    const observer = new PerformanceObserver((list, obs) => {
      if (!list.getEntries().some(entry => entry.name === 'contentAppeared')) {
        return;
      }

      STARTUP_MEASURES.forEach(({name, start, end}) => {
        try {
          performance.measure(name, start, end);
        } catch {
          // A mark may be unavailable in some configurations (e.g.
          // runJsBundle* is absent when running with a debugger attached).
        }
      });

      Environment.getEnvironment().then(envName => {
        performance.getEntriesByType('measure').forEach(entry => {
          console.debug(
            `Timing:${envName}.kiroku.${entry.name}`,
            entry.duration,
          );
        });
      });

      obs.disconnect();
    });
    observer.observe({type: 'react-native-mark', buffered: true});
  },
};

export default startupMetrics;
