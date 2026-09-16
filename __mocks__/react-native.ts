/**
 * Manual jest mock for `react-native`.
 *
 * Jest applies this file to every `require('react-native')` automatically
 * because it sits in the root `__mocks__` folder. That first `require` loads
 * this file and hands the importer this file's own `module.exports`; every
 * later importer receives whatever the `jest.doMock` factory below returns.
 * Both paths must resolve to the same object, otherwise the first importer
 * (often Onyx's `batch.native.js`, or a module reading `Easing` or `Platform`
 * at load) sees an empty module. That is why the mock is built once at module
 * scope, registered with `jest.doMock`, and also assigned to `module.exports`.
 *
 * Everything not overridden below falls through to the real module via the
 * prototype chain, including `unstable_batchedUpdates`, so Onyx batches
 * subscriber notifications through the real renderer in tests, exactly as in
 * production. In React 19 that wrapper runs the callback synchronously, so
 * tests observe no extra delay from it.
 *
 * The overrides keep their state (dimensions, initial URL, app state
 * listeners) for the lifetime of the test file, including across
 * `jest.resetModules()`, because jest keeps the `doMock` registration and the
 * factory keeps returning this same object.
 */

/* eslint-disable import/no-import-module-exports */
// eslint-disable-next-line no-restricted-imports
import * as ReactNative from 'react-native';

const {BootSplash} = ReactNative.NativeModules;

let url = 'https://petrcala.github.com/Kiroku';
const getInitialURL = () => Promise.resolve(url);

let appState: ReactNative.AppStateStatus = 'active';
let count = 0;
const changeListeners: Record<
  number,
  (state: ReactNative.AppStateStatus) => void
> = {};

// Tests will run with the app in a typical small screen size by default. We do this since the react-native test renderer
// runs against index.native.js source and so anything that is testing a component reliant on withWindowDimensions()
// would be most commonly assumed to be on a mobile phone vs. a tablet or desktop style view. This behavior can be
// overridden by explicitly setting the dimensions inside a test via Dimensions.set()
let dimensions: Record<string, number> = {
  width: 300,
  height: 700,
  scale: 1,
  fontScale: 1,
};

type ReactNativeMock = typeof ReactNative & {
  NativeModules: typeof ReactNative.NativeModules & {
    BootSplash: {
      getVisibilityStatus: typeof BootSplash.getVisibilityStatus;
      hide: typeof BootSplash.hide;
      logoSizeRatio: number;
      logoWidth: number;
      logoHeight: number;
      navigationBarHeight: number;
    };
  };
  Linking: typeof ReactNative.Linking & {
    setInitialURL: (newUrl: string) => void;
  };
  AppState: typeof ReactNative.AppState & {
    emitCurrentTestState: (state: ReactNative.AppStateStatus) => void;
  };
};

const reactNativeMock = Object.setPrototypeOf(
  {
    NativeModules: {
      ...ReactNative.NativeModules,
      BootSplash: {
        getVisibilityStatus: jest.fn(),
        hide: jest.fn(),
        logoSizeRatio: 1,
        logoWidth: 100,
        logoHeight: 100,
        navigationBarHeight: 0,
      },
    },
    Linking: {
      ...ReactNative.Linking,
      getInitialURL,
      setInitialURL(newUrl: string) {
        url = newUrl;
      },
    },
    AppState: {
      ...ReactNative.AppState,
      get currentState() {
        return appState;
      },
      emitCurrentTestState(state: ReactNative.AppStateStatus) {
        appState = state;
        Object.entries(changeListeners).forEach(([, listener]) =>
          listener(appState),
        );
      },
      addEventListener(
        type: ReactNative.AppStateEvent,
        listener: (state: ReactNative.AppStateStatus) => void,
      ) {
        if (type === 'change') {
          const originalCount = count;
          changeListeners[originalCount] = listener;
          ++count;
          return {
            remove: () => {
              delete changeListeners[originalCount];
            },
          };
        }

        return ReactNative.AppState.addEventListener(type, listener);
      },
    },
    Dimensions: {
      ...ReactNative.Dimensions,
      addEventListener: jest.fn(),
      get: () => dimensions,
      set: (newDimensions: Record<string, number>) => {
        dimensions = newDimensions;
      },
    },

    // `runAfterInteractions` method would normally be triggered after the native animation is completed,
    // we would have to mock waiting for the animation end and more state changes,
    // so it seems easier to just run the callback immediately in tests.
    InteractionManager: {
      ...ReactNative.InteractionManager,
      runAfterInteractions: (callback: () => void) => callback(),
    },
  },
  ReactNative,
) as ReactNativeMock;

// Later importers resolve through jest's mock registry and get this factory's
// return value, so it must hand back the very same object exported below.
jest.doMock('react-native', () => reactNativeMock);

module.exports = reactNativeMock;
