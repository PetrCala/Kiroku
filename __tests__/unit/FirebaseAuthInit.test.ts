/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- jest mock factory keys (__esModule) are dictated by Node module shape, and this test exercises the real FirebaseApp.native module via isolateModules + dynamic require() */

// `firebase/auth`, `firebase/app`, and AsyncStorage are already mocked globally
// in jest/setup.ts. Mock the remaining direct deps of FirebaseApp.native so we
// can drive its init paths and assert the loud Crashlytics signal.
jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: jest.fn(() => ({})),
  log: jest.fn(),
  recordError: jest.fn(),
}));

jest.mock('@src/CONFIG', () => ({
  __esModule: true,
  default: {SEND_CRASH_REPORTS: true},
}));

jest.mock('@libs/Firebase/FirebaseConfig', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    alert: jest.fn(),
    hmmm: jest.fn(),
  },
}));

describe('FirebaseApp.native auth initialization', () => {
  test('initializes auth once with AsyncStorage persistence and reuses the singleton', () => {
    jest.isolateModules(() => {
      const auth = require('firebase/auth');
      auth.getReactNativePersistence.mockReturnValue('rn-persistence');
      const instance = {tag: 'async-auth'};
      auth.initializeAuth.mockReturnValue(instance);

      const mod = require('@libs/Firebase/FirebaseApp.native');
      const first = mod.initFirebaseAuth();

      // The AsyncStorage-backed persistence is what survives a cold start.
      expect(auth.getReactNativePersistence).toHaveBeenCalledTimes(1);
      expect(auth.initializeAuth).toHaveBeenCalledTimes(1);
      expect(auth.initializeAuth).toHaveBeenCalledWith(undefined, {
        persistence: 'rn-persistence',
      });
      expect(first).toBe(instance);

      // getFirebaseAuth returns the same instance and does NOT re-initialize.
      const second = mod.getFirebaseAuth();
      expect(second).toBe(instance);
      expect(auth.initializeAuth).toHaveBeenCalledTimes(1);
    });
  });

  test('reports the failure to Crashlytics (loud, not silent) and falls back to memory persistence', () => {
    jest.isolateModules(() => {
      const auth = require('firebase/auth');
      const crashlytics = require('@react-native-firebase/crashlytics');
      auth.getReactNativePersistence.mockReturnValue('rn-persistence');
      const memoryInstance = {tag: 'memory-auth'};
      auth.initializeAuth
        .mockImplementationOnce(() => {
          throw new Error('AsyncStorage not ready');
        })
        .mockImplementationOnce(() => memoryInstance);

      const mod = require('@libs/Firebase/FirebaseApp.native');
      const result = mod.initFirebaseAuth();

      // Fell back to memory persistence so the app still runs...
      expect(auth.initializeAuth).toHaveBeenCalledTimes(2);
      expect(result).toBe(memoryInstance);
      // ...but the AsyncStorage failure was surfaced, not swallowed.
      expect(crashlytics.recordError).toHaveBeenCalledTimes(1);
      expect(crashlytics.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('session will NOT persist'),
      );
    });
  });
});
