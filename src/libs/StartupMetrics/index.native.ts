import performance, {PerformanceObserver} from 'react-native-performance';
import * as Environment from '@libs/Environment/Environment';
import CONST from '@src/CONST';
import type {StartupMark} from './types';
import type StartupMetrics from './types';

let initialized = false;
let splashReported = false;

type Measure = {
  readonly name: string;
  readonly start: string;
  readonly end: string;
};

// Two halves of a cold start, settling at different moments, so each is flushed
// on its own. Keeping them apart means a splash animation that never completes
// (no `splashHidden` mark) can't swallow the launch numbers with it.
const LAUNCH_MEASURES: readonly Measure[] = [
  // OS process spawn → ContentProvider/AppDelegate first frame
  {name: 'nativeLaunch', start: 'nativeLaunchStart', end: 'nativeLaunchEnd'},
  // JS bundle parse + initial execution
  {name: 'runJsBundle', start: 'runJsBundleStart', end: 'runJsBundleEnd'},
  // Process spawn → first content visible (still behind the splash)
  {name: 'appStartup', start: 'nativeLaunchStart', end: 'contentAppeared'},
];

const SPLASH_MEASURES: readonly Measure[] = [
  // Process spawn → the splash gate opening. This is the part that moves when
  // the data the splash waits on gets slower or faster.
  {name: 'splashGate', start: 'nativeLaunchStart', end: 'splashHideStart'},
  // The hide itself: the native cross-dissolve plus the JS overlay animation.
  {name: 'splashHide', start: 'splashHideStart', end: 'splashHidden'},
  // Process spawn → splash gone, which is the number a user would recognize as
  // "how long the app took to start".
  {name: 'coldStart', start: 'nativeLaunchStart', end: 'splashHidden'},
];

/**
 * `console.debug` is stripped from every release bundle by
 * babel-plugin-transform-remove-console (see `babel.config.js`), so on a real
 * build these lines were compiled away and the timings went nowhere: measuring
 * a release build meant patching this file first. Ad-hoc and staging builds are
 * the ones worth profiling, so those write through `console.warn`, which the
 * plugin is configured to keep.
 *
 * Production stays on `console.debug` so shipped builds emit nothing, and
 * development keeps it too, otherwise every reload would raise a LogBox warning.
 */
function write(envName: string, label: string, duration: number): void {
  if (
    envName === CONST.ENVIRONMENT.ADHOC ||
    envName === CONST.ENVIRONMENT.STAGING
  ) {
    // eslint-disable-next-line no-console
    console.warn(label, duration);
    return;
  }
  console.debug(label, duration);
}

function report(measures: readonly Measure[]): void {
  const durations: Array<[string, number]> = [];

  measures.forEach(({name, start, end}) => {
    try {
      durations.push([name, performance.measure(name, start, end).duration]);
    } catch {
      // A mark may be unavailable in some configurations (e.g.
      // runJsBundle* is absent when running with a debugger attached).
    }
  });

  if (durations.length === 0) {
    return;
  }

  Environment.getEnvironment().then(envName => {
    durations.forEach(([name, duration]) => {
      write(envName, `Timing:${envName}.kiroku.${name}`, duration);
    });
  });
}

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

      report(LAUNCH_MEASURES);
      obs.disconnect();
    });
    observer.observe({type: 'react-native-mark', buffered: true});
  },

  mark: (name: StartupMark) => {
    try {
      performance.mark(name);
    } catch {
      // Marking must never be able to break a launch.
      return;
    }

    // `splashHidden` closes the splash pair, so flush it here rather than from
    // the observer above: it is a mark this app records, not a react-native-mark.
    if (name === 'splashHidden' && !splashReported) {
      splashReported = true;
      report(SPLASH_MEASURES);
    }
  },
};

export default startupMetrics;
