require('dotenv').config();
const path = require('path');

const IS_E2E_TESTING = process.env.E2E_TESTING === 'true';

// Single source of truth shared with scripts/react-compiler-compliance-check.ts
const ReactCompilerConfig = require('./config/babel/reactCompilerConfig');

// ─── Shared alias list ────────────────────────────────────────────────────────
// Single source of truth so metro and test configs don't drift.
//
// `@src/SCREENS` is declared *before* `@src` because babel-plugin-module-resolver
// matches aliases in declaration order via Array.find(). The more specific
// `@src/SCREENS` entry must win so we can route it around a Windows-only bug:
// Node's `path.relative()` treats Windows paths as case-insensitive, so the
// relative-path math inside the plugin folds `src/SCREENS.ts` into the sibling
// `src/screens/` directory. From a file under `src/screens/` the plugin then
// emits `./..` (one level up) instead of `../../SCREENS`, and Metro fails to
// resolve. Pointing the alias at an absolute path makes the plugin skip
// `mapToRelative` entirely and hand Metro the file path directly. macOS/Linux
// behave the same way once the path is absolute, so the override is safe to
// apply unconditionally.
const moduleResolverAliases = {
  '@src/SCREENS': path.resolve(__dirname, 'src/SCREENS.ts'),
  '@assets': './assets',
  '@auth': './src/auth',
  '@components': './src/components',
  '@context': './src/context',
  '@database': './src/database',
  '@desktop': './desktop',
  '@hooks': './src/hooks',
  '@libs': './src/libs',
  '@navigation': './src/libs/Navigation',
  '@screens': './src/screens',
  '@src': './src',
  '@storage': './src/storage',
  '@styles': './src/styles',
  '@utils': './src/utils',
  '@userActions': './src/libs/actions',
  '@github': './.github',
};

// ─── TEST environment (babel-jest) ───────────────────────────────────────────
// Intentionally lightweight: no React Compiler, no worklets, no Hermes preset.
// Unit tests run on Node — they don't need any of that.
// Fewer module-resolver extensions = fewer stat() calls per import resolution.
const testEnv = {
  // @react-native/babel-preset handles the full mix of Flow + TypeScript syntax
  // found in react-native's own .js files (e.g. `number => void` Flow arrow
  // types, mixed `as`-cast + $Flow$ annotations, etc.). Replacing it with
  // individual presets breaks on these edge cases, so we keep it as the base.
  //
  // What we omit vs. the metro config:
  //   babel-plugin-react-compiler  — full static analysis pass on every file;
  //                                   not needed for unit tests (expensive)
  //   react-native-worklets/plugin — worklet rewriting; not needed for unit tests
  presets: [require('@react-native/babel-preset')],
  plugins: [
    ['@babel/plugin-transform-flow-strip-types'],
    ['@babel/plugin-proposal-class-properties', {loose: true}],
    ['@babel/plugin-proposal-private-methods', {loose: true}],
    ['@babel/plugin-proposal-private-property-in-object', {loose: true}],
    [
      'module-resolver',
      {
        extensions: ['.native.ts', '.native.tsx', '.ts', '.tsx', '.js', '.jsx'],
        alias: moduleResolverAliases,
      },
    ],
    '@babel/plugin-transform-export-namespace-from',
  ],
};

// ─── WEBPACK (web bundler) ────────────────────────────────────────────────────
const defaultPresets = [
  '@babel/preset-react',
  ['@babel/preset-env', {targets: {node: 20}}],
  '@babel/preset-flow',
  '@babel/preset-typescript',
];
const defaultPlugins = [
  ['babel-plugin-react-compiler', ReactCompilerConfig], // must run first!
  // Adding the commonjs: true option to react-native-web plugin can cause styling conflicts
  ['react-native-web'],

  '@babel/transform-runtime',
  '@babel/plugin-proposal-class-properties',
  [
    '@babel/plugin-transform-object-rest-spread',
    {useBuiltIns: true, loose: true},
  ],

  // We use `transform-class-properties` for transforming ReactNative libraries and do not use it for our own
  // source code transformation as we do not use class property assignment.
  '@babel/plugin-transform-class-properties',

  // Keep it last
  'react-native-worklets/plugin',
];

const webpack = {
  presets: defaultPresets,
  plugins: defaultPlugins,
};

// ─── METRO (iOS / Android bundler) ───────────────────────────────────────────
// Use babel-preset-expo here (it extends @react-native/babel-preset) so the
// Expo modules we ship — expo-image, expo-image-manipulator, expo-image-picker,
// expo-modules-core — get process.env.EXPO_OS inlined at compile time. Without
// this, Expo packages log a "process.env.EXPO_OS is not defined" warning on
// every Platform.OS lookup and fall back to a slower runtime branch.
const metro = {
  presets: [require('babel-preset-expo')],
  plugins: [
    ['babel-plugin-react-compiler', ReactCompilerConfig], // must run first!

    // This is needed due to a react-native bug: https://github.com/facebook/react-native/issues/29084#issuecomment-1030732709
    // It is included in metro-react-native-babel-preset but needs to be before plugin-proposal-class-properties or FlatList will break
    '@babel/plugin-transform-flow-strip-types',

    ['@babel/plugin-proposal-class-properties', {loose: true}],
    ['@babel/plugin-proposal-private-methods', {loose: true}],
    ['@babel/plugin-proposal-private-property-in-object', {loose: true}],
    [
      'module-resolver',
      {
        extensions: [
          '.native.js',
          '.native.jsx',
          '.native.ts',
          '.native.tsx',
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
          '.ios.js',
          '.ios.jsx',
          '.ios.ts',
          '.ios.tsx',
          '.android.js',
          '.android.jsx',
          '.android.ts',
          '.android.tx',
        ],
        alias: moduleResolverAliases,
      },
    ],
    '@babel/plugin-transform-export-namespace-from',
    // The worklets babel plugin needs to be last
    'react-native-worklets/plugin',
  ],
  env: {
    production: {
      // Keep console logs for e2e tests
      plugins: IS_E2E_TESTING
        ? []
        : [['transform-remove-console', {exclude: ['error', 'warn']}]],
    },
  },
};

// ─── Entry point ─────────────────────────────────────────────────────────────
// For `react-native` (iOS/Android) caller will be "metro"
// For `webpack` (Web) caller will be "@babel-loader"
// For jest, it will be "babel-jest"
// For `storybook` there won't be any config at all so we must give default argument of an empty object
module.exports = api => {
  // api.caller() implicitly configures caching keyed on the caller name,
  // so Babel won't re-evaluate this function on every file transform.
  const runningIn = api.caller((args = {}) => args.name);

  if (runningIn === 'babel-jest') {
    return testEnv;
  }
  return runningIn === 'metro' ? metro : webpack;
};
