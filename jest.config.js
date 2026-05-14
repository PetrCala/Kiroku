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
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo-modules-core|react-native-gesture-handler|react-native-reanimated|react-native-worklets|react-native-nitro-sqlite|react-native-nitro-modules))',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules', '<rootDir>/.claude/'],
  watchPathIgnorePatterns: ['<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
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
  setupFilesAfterEnv: ['<rootDir>/jest/setupAfterEnv.ts'],
  cacheDirectory: '<rootDir>/.jest-cache',
  moduleNameMapper: {
    '\\.(lottie)$': '<rootDir>/__mocks__/fileMock.ts',
    '^expo/src/winter': '<rootDir>/__mocks__/emptyMock.ts',
  },
};
