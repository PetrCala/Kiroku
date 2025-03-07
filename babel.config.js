require('dotenv').config();

const defaultPresets = [
  '@babel/preset-react',
  '@babel/preset-env',
  '@babel/preset-flow',
  '@babel/preset-typescript',
];
const defaultPlugins = [
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
  'transform-class-properties',

  // Keep it last
  'react-native-reanimated/plugin',
];

const webpack = {
  presets: defaultPresets,
  plugins: defaultPlugins,
};

const metro = {
  presets: [require('@react-native/babel-preset')],
  plugins: [
    // This is needed due to a react-native bug: https://github.com/facebook/react-native/issues/29084#issuecomment-1030732709
    // It is included in metro-react-native-babel-preset but needs to be before plugin-proposal-class-properties or FlatList will break
    '@babel/plugin-transform-flow-strip-types',

    ['@babel/plugin-proposal-class-properties', {loose: true}],
    ['@babel/plugin-proposal-private-methods', {loose: true}],
    ['@babel/plugin-proposal-private-property-in-object', {loose: true}],
    // The reanimated babel plugin needs to be last, as stated here: https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/installation
    'react-native-reanimated/plugin',
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
        alias: {
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
        },
      },
    ],
  ],
  // env: {
  //   production: {
  //     // Keep console logs for e2e tests
  //     plugins: IS_E2E_TESTING
  //       ? []
  //       : [['transform-remove-console', {exclude: ['error', 'warn']}]],
  //   },
  // },
};

module.exports = api => {
  console.debug('babel.config.js');
  console.debug('  - api.version:', api.version);
  console.debug('  - api.env:', api.env());
  console.debug('  - process.env.NODE_ENV:', process.env.NODE_ENV);
  console.debug('  - process.env.BABEL_ENV:', process.env.BABEL_ENV);

  // For `react-native` (iOS/Android) caller will be "metro"
  // For `webpack` (Web) caller will be "@babel-loader"
  // For jest, it will be babel-jest
  // For `storybook` there won't be any config at all so we must give default argument of an empty object
  const runningIn = api.caller((args = {}) => args.name);
  console.debug('  - running in: ', runningIn);

  return ['metro', 'babel-jest'].includes(runningIn) ? metro : webpack;
};
