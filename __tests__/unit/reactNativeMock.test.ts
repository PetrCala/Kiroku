/**
 * Guards the root `__mocks__/react-native.ts` manual mock against a subtle
 * jest behaviour: the importer whose `require('react-native')` loads the mock
 * file receives that file's `module.exports`, while every later importer gets
 * the `jest.doMock` factory's return value. If the two ever diverge again, the
 * first importer sees an empty module (`Platform`, `Easing`, `StyleSheet`, and
 * `unstable_batchedUpdates` all `undefined`).
 *
 * This file deliberately has no value `import` statements: babel hoists them,
 * and the test needs to control which `require('react-native')` runs first.
 * The type-only import below is erased at compile time. No jest setup file
 * touches `react-native`, so the first call below is the first one in this
 * module registry.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

// eslint-disable-next-line no-restricted-imports
import type * as ReactNativeModule from 'react-native';

describe('react-native manual mock', () => {
  const first = require('react-native') as typeof ReactNativeModule;
  const second = require('react-native') as typeof ReactNativeModule;

  it('hands the first importer the same object as every later importer', () => {
    expect(first).toBe(second);
  });

  it('exposes the real module through the prototype chain to the first importer', () => {
    expect(typeof first.Platform).toBe('object');
    expect(typeof first.StyleSheet.create).toBe('function');
    expect(typeof first.Easing.out).toBe('function');
    expect(typeof first.unstable_batchedUpdates).toBe('function');
  });

  it('applies the test overrides to the first importer', () => {
    expect(first.Dimensions.get('window')).toEqual(
      expect.objectContaining({width: 300, height: 700}),
    );
    expect(first.NativeModules.BootSplash).toEqual(
      expect.objectContaining({logoWidth: 100}),
    );
  });
});
