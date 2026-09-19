import type StartupMetricsType from '@libs/StartupMetrics/types';

/**
 * The point of these metrics is that they survive a release build, where
 * `babel-plugin-transform-remove-console` deletes every `console.debug`. That
 * is a build-time property no unit test can observe, so what is covered here is
 * the part that decides it: which console method each environment writes
 * through, and that the splash pair is flushed independently of the launch
 * pair.
 */
type MarkEntry = {name: string; startTime: number};

type ObserverCallback = (
  list: {getEntries: () => MarkEntry[]},
  observer: {disconnect: () => void},
) => void;

const mockMarks: MarkEntry[] = [];
let mockObserverCallback: ObserverCallback | undefined;

const disconnect = jest.fn();

jest.mock('react-native-performance', () => {
  const findMark = (name: string) =>
    mockMarks.find(entry => entry.name === name);

  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __esModule: true,
    default: {
      mark: (name: string) => {
        const entry = {name, startTime: mockMarks.length * 100};
        mockMarks.push(entry);
        return entry;
      },
      measure: (name: string, start: string, end: string) => {
        const from = findMark(start);
        const to = findMark(end);
        if (!from || !to) {
          throw new Error(`missing mark for ${name}`);
        }
        return {name, duration: to.startTime - from.startTime};
      },
    },
    PerformanceObserver: class {
      constructor(callback: ObserverCallback) {
        mockObserverCallback = callback;
      }

      observe() {}
    },
  };
});

const mockGetEnvironment = jest.fn<Promise<string>, []>();
jest.mock('@libs/Environment/Environment', () => ({
  getEnvironment: () => mockGetEnvironment(),
}));

const flushPromises = () =>
  new Promise(resolve => {
    process.nextTick(resolve);
  });

/** Load a fresh copy, since the module keeps per-launch state in closures. */
function loadStartupMetrics(): StartupMetricsType {
  let startupMetrics: StartupMetricsType | undefined;
  jest.isolateModules(() => {
    startupMetrics =
      // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
      (
        require('@libs/StartupMetrics/index.native') as {
          default: StartupMetricsType;
        }
      ).default;
  });
  if (!startupMetrics) {
    throw new Error('StartupMetrics did not load');
  }
  return startupMetrics;
}

/** Drive the observer the way react-native-performance would on a real launch. */
function emitNativeMarks() {
  [
    'nativeLaunchStart',
    'nativeLaunchEnd',
    'runJsBundleStart',
    'runJsBundleEnd',
    'contentAppeared',
  ].forEach(name => {
    mockMarks.push({name, startTime: mockMarks.length * 100});
  });
  mockObserverCallback?.({getEntries: () => mockMarks}, {disconnect});
}

const labels = (spy: jest.SpyInstance): unknown[] =>
  (spy.mock.calls as unknown[][]).map(call => call[0]);

describe('StartupMetrics', () => {
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    mockMarks.length = 0;
    mockObserverCallback = undefined;
    disconnect.mockClear();
    mockGetEnvironment.mockReset();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('writes launch timings through console.warn on an ad-hoc build', async () => {
    mockGetEnvironment.mockResolvedValue('adhoc');
    const startupMetrics = loadStartupMetrics();

    startupMetrics.init();
    emitNativeMarks();
    await flushPromises();

    expect(labels(warnSpy)).toEqual([
      'Timing:adhoc.kiroku.nativeLaunch',
      'Timing:adhoc.kiroku.runJsBundle',
      'Timing:adhoc.kiroku.appStartup',
    ]);
    expect(debugSpy).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps production on console.debug, which a release build strips', async () => {
    mockGetEnvironment.mockResolvedValue('production');
    const startupMetrics = loadStartupMetrics();

    startupMetrics.init();
    emitNativeMarks();
    await flushPromises();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(labels(debugSpy)).toEqual([
      'Timing:production.kiroku.nativeLaunch',
      'Timing:production.kiroku.runJsBundle',
      'Timing:production.kiroku.appStartup',
    ]);
  });

  it('reports the splash pair when the splash is gone, not when content appears', async () => {
    mockGetEnvironment.mockResolvedValue('staging');
    const startupMetrics = loadStartupMetrics();

    startupMetrics.init();
    emitNativeMarks();
    await flushPromises();
    warnSpy.mockClear();

    startupMetrics.mark('splashHideStart');
    await flushPromises();
    expect(warnSpy).not.toHaveBeenCalled();

    startupMetrics.mark('splashHidden');
    await flushPromises();

    expect(labels(warnSpy)).toEqual([
      'Timing:staging.kiroku.splashGate',
      'Timing:staging.kiroku.splashHide',
      'Timing:staging.kiroku.coldStart',
    ]);
  });

  it('reports the splash pair once, even if the splash hide runs twice', async () => {
    mockGetEnvironment.mockResolvedValue('staging');
    const startupMetrics = loadStartupMetrics();

    startupMetrics.init();
    emitNativeMarks();
    await flushPromises();
    warnSpy.mockClear();

    startupMetrics.mark('splashHideStart');
    startupMetrics.mark('splashHidden');
    startupMetrics.mark('splashHidden');
    await flushPromises();

    expect(labels(warnSpy)).toHaveLength(3);
  });

  it('still reports the launch pair when the splash never finishes hiding', async () => {
    mockGetEnvironment.mockResolvedValue('adhoc');
    const startupMetrics = loadStartupMetrics();

    startupMetrics.init();
    emitNativeMarks();
    startupMetrics.mark('splashHideStart');
    await flushPromises();

    expect(labels(warnSpy)).toEqual([
      'Timing:adhoc.kiroku.nativeLaunch',
      'Timing:adhoc.kiroku.runJsBundle',
      'Timing:adhoc.kiroku.appStartup',
    ]);
  });
});
