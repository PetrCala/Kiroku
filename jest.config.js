const testFileExtension = '[jt]s?(x)';
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    `<rootDir>/__tests__/ui/**/*.${testFileExtension}`,
    `<rootDir>/__tests__/unit/**/*.${testFileExtension}`,
    `<rootDir>/__tests__/actions/**/*.${testFileExtension}`,
    `<rootDir>/?(*.)+(spec|test).${testFileExtension}`,
  ],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
    '^.+\\.svg?$': 'jest-transformer-svg',
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/(?!react-native)/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules'],
  globals: {
    __DEV__: true,
    WebSocket: {},
  },
  fakeTimers: {
    enableGlobally: true,
    doNotFake: ['nextTick'],
  },
  testEnvironment: 'jsdom',
  setupFiles: [
    '<rootDir>/jest/setup.ts',
    // './node_modules/@react-native-google-signin/google-signin/jest/build/setup.js',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/jest/setupAfterEnv.ts',
    '<rootDir>/__tests__/perf-test/setupAfterEnv.ts',
  ],
  cacheDirectory: '<rootDir>/.jest-cache',
  moduleNameMapper: {
    '\\.(lottie)$': '<rootDir>/__mocks__/fileMock.ts',
  },
};
