import {CleanWebpackPlugin} from 'clean-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import dotenv from 'dotenv';
import fs from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import webpack from 'webpack';
import type {Configuration} from 'webpack';
import type Environment from './types';

dotenv.config();

// node_modules packages that ship JSX/`react-native` imports and therefore must
// be transpiled by babel-loader (and pick up the `react-native` -> `react-native-web`
// alias). Everything else under node_modules is excluded for speed.
//
// Trimmed vs. Expensify upstream: dropped libs Kiroku does not ship
// (material-top-tabs, google-places-autocomplete, qrcode-svg, view-shot,
// @react-native-picker, expo-audio/expo-video). KEPT victory-native + skia
// because Kiroku's charts (and `src/setup` boot path) import them on web.
const includeModules = [
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-picker-select',
  'react-native-web',
  'react-native-webview',
  // Cover the whole @react-navigation scope (native, native-stack, stack, elements, core,
  // routers, bottom-tabs, …). Sub-packages like @react-navigation/elements ship ESM that calls
  // require() at runtime and must be transpiled or they throw "require is not defined" on web.
  '@react-navigation',
  'react-native-gesture-handler',
  'react-native-render-html',
  'react-native-calendars',
  'react-native-pager-view',
  'react-native-tab-view',
  // Transitive dep of react-native-calendars that ships untranspiled JSX
  'react-native-swipe-gestures',
  'react-native-modal',
  'react-native-animatable',
  'react-native-linear-gradient',
  '@gorhom/portal',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-svg',
  '@react-native/assets-registry',
  'expo',
  'expo-image',
  'expo-image-manipulator',
  'expo-modules-core',
  'victory-native',
  '@shopify/react-native-skia',
].join('|');

const environmentToLogoSuffixMap: Record<string, string> = {
  production: '--prod',
  staging: '--staging',
  dev: '--dev',
  adhoc: '--adhoc',
};

// Map a `.env.<env>` filename to the matching `assets/images/app-logo<suffix>.svg`
// used as the boot splash logo. Defaults to the dev logo.
function mapEnvironmentToLogoSuffix(environmentFile: string): string {
  let environment = environmentFile.split('.').at(2) ?? 'dev';
  if (environment === 'development') {
    environment = 'dev';
  }
  return environmentToLogoSuffixMap[environment] ?? '--dev';
}

/**
 * Get the common webpack configuration shared by the dev and production web builds.
 */
const getCommonConfiguration = ({
  file = '.env',
  platform = 'web',
}: Environment): Configuration => {
  const isDevelopment = file === '.env' || file === '.env.development';

  /* eslint-disable @typescript-eslint/naming-convention */
  return {
    mode: isDevelopment ? 'development' : 'production',
    devtool: 'source-map',
    entry: {
      main: './index.js',
    },
    output: {
      // Use simple filenames in development to prevent memory leaks from contenthash changes
      filename: isDevelopment
        ? '[name].bundle.js'
        : '[name]-[contenthash].bundle.js',
      path: path.resolve(__dirname, '../../dist'),
      publicPath: '/',
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: 'web/index.html',
        filename: 'index.html',
        splashLogo: fs.readFileSync(
          path.resolve(
            __dirname,
            `../../assets/images/app-logo${mapEnvironmentToLogoSuffix(file)}.svg`,
          ),
          'utf-8',
        ),
        isWeb: platform === 'web',
        isProduction: file === '.env.production',
        isStaging: file === '.env.staging',
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),

      // Copies static web assets into the dist/ folder.
      new CopyPlugin({
        patterns: [
          {from: 'web/favicon.png'},
          {from: 'web/apple-touch-icon.png'},
          {from: 'web/og-preview-image.png'},
          {from: 'web/manifest.json'},
          {from: 'assets/css', to: 'css'},
          {from: 'assets/fonts/web', to: 'fonts'},

          // CanvasKit WASM file for @shopify/react-native-skia web support (used by the stats charts)
          {from: 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm'},
        ],
      }),
      new webpack.EnvironmentPlugin({JEST_WORKER_ID: ''}),
      new webpack.DefinePlugin({
        process: {env: {}},
        // Define EXPO_OS for the web platform to silence the expo-modules-core warning
        'process.env.EXPO_OS': JSON.stringify('web'),
        // react-native-config does not work on web; the `react-native-config` -> `react-web-config`
        // alias reads the injected config object instead. See config/webpack/webpack.common.ts (#927).
        __REACT_WEB_CONFIG__: JSON.stringify(
          dotenv.config({path: file}).parsed,
        ),

        // React Native's JS environment requires the global __DEV__ variable to be accessible.
        // See https://reactnative.dev/docs/javascript-environment
        __DEV__: /staging|prod|adhoc/.test(file) === false,
      }),
      ...(isDevelopment ? [] : [new MiniCssExtractPlugin()]),
    ],
    module: {
      rules: [
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false,
          },
        },
        // Transpile all the app's JS/TS plus the react-native libraries listed in `includeModules`.
        {
          test: /\.(js|ts)x?$/,
          loader: 'babel-loader',
          // `sourceType: 'unambiguous'` lets babel detect per-file whether each module is ESM or CJS.
          // Without it (default 'module'), @babel/transform-runtime injects ESM helper imports into the
          // CJS-only builds some RN libs ship (e.g. react-native-render-html's lib/commonjs, which has no
          // ESM `module` entry), producing a mixed module that webpack treats as ESM where the bare
          // `exports` is undefined → "exports is not defined" at runtime.
          options: {
            sourceType: 'unambiguous',
          },
          // Kiroku's package.json declares `"type": "commonjs"` (needed for ts-node/metro tooling),
          // which would otherwise make webpack parse `.js` files (e.g. index.js) as CommonJS and reject
          // the ESM `import`/`export` that babel emits. Forcing `javascript/auto` restores per-file
          // ESM/CJS auto-detection. Upstream doesn't need this because its package.json has no `"type"`.
          type: 'javascript/auto',

          /**
           * Exclude node_modules except the packages we need to transpile (they import
           * "react-native" internally and use JSX that the browser can't run directly).
           * Also exclude `.native.*` files so native-only implementations never land in the web bundle.
           */
          exclude: [
            new RegExp(
              `node_modules/(?!(${includeModules})/).*|\\.native\\.(js|jsx|ts|tsx)$`,
            ),
          ],
        },

        // Local raster images
        {
          test: /\.(png|jpe?g|gif)$/i,
          type: 'asset',
        },

        // SVGs become React components via @svgr/webpack. On web, `import Icon from '*.svg'` is a
        // component rendered by src/components/ImageSVG/index.tsx (native uses expo-image instead).
        {
          test: /\.svg$/,
          resourceQuery: {not: [/raw/]},
          exclude: /node_modules/,
          use: [
            {
              loader: '@svgr/webpack',
            },
          ],
        },
        {
          test: /\.css$/i,
          use: isDevelopment
            ? ['style-loader', 'css-loader']
            : [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          test: /\.(woff|woff2|ttf|otf)$/i,
          type: 'asset',
        },
        {
          resourceQuery: /raw/,
          type: 'asset/source',
        },
        // This prevents an import error from react-native-tab-view/lib/module/TabView.js
        // where Pager is imported without an extension due to platform-specific implementations.
        {
          test: /\.js$/,
          resolve: {
            fullySpecified: false,
          },
          include: [
            path.resolve(
              __dirname,
              '../../node_modules/react-native-tab-view/lib/module/TabView.js',
            ),
          ],
        },
      ],
    },
    resolve: {
      alias: {
        'react-native-config': 'react-web-config',
        'react-native$': 'react-native-web',
        // react-native-linear-gradient has no web build (it calls requireNativeComponent). Point it at a
        // local CSS-gradient shim so the login landing renders on web. A faithful impl is deferred to #930.
        'react-native-linear-gradient$': path.resolve(
          __dirname,
          '../../src/libs/shims/LinearGradientWeb.tsx',
        ),
        // Use victory-native source files instead of the pre-compiled dist (which uses CommonJS exports)
        'victory-native': path.resolve(
          __dirname,
          '../../node_modules/victory-native/src/index.ts',
        ),
        // Required for @shopify/react-native-skia web support
        'react-native/Libraries/Image/AssetRegistry': false,
        // Module aliases for web (mirrors tsconfig.json `paths` and babel module-resolver)
        '@assets': path.resolve(__dirname, '../../assets'),
        '@auth': path.resolve(__dirname, '../../src/libs/auth/'),
        '@components': path.resolve(__dirname, '../../src/components/'),
        '@context': path.resolve(__dirname, '../../src/context/'),
        '@database': path.resolve(__dirname, '../../src/database/'),
        '@desktop': path.resolve(__dirname, '../../desktop/'),
        '@github': path.resolve(__dirname, '../../.github/'),
        '@hooks': path.resolve(__dirname, '../../src/hooks/'),
        '@libs': path.resolve(__dirname, '../../src/libs/'),
        '@navigation': path.resolve(__dirname, '../../src/libs/Navigation/'),
        '@screens': path.resolve(__dirname, '../../src/screens/'),
        // Alias for files like `ONYXKEYS` and `CONST`.
        '@src': path.resolve(__dirname, '../../src/'),
        '@storage': path.resolve(__dirname, '../../src/storage/'),
        '@styles': path.resolve(__dirname, '../../src/styles/'),
        '@userActions': path.resolve(__dirname, '../../src/libs/actions/'),
        '@utils': path.resolve(__dirname, '../../src/utils/'),
      },

      // React Native libraries may ship web-specific module implementations with the extension `.web.js`;
      // without this, web would try to use native implementations and break in non-obvious ways.
      // This is also why we use `.website.js` for our own web-specific files.
      extensions: [
        '.web.js',
        '.website.js',
        '.js',
        '.jsx',
        '.web.ts',
        '.website.ts',
        '.website.tsx',
        '.ts',
        '.web.tsx',
        '.tsx',
      ],
      fallback: {
        'process/browser': require.resolve('process/browser'),
        crypto: false,
        fs: false,
        path: false,
      },
    },
    optimization: {
      runtimeChunk: 'single',
      splitChunks: {
        cacheGroups: {
          // Extract all 3rd party dependencies into a separate js file for more efficient caching.
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            // Capture only the scripts needed for the initial load; async imports are grouped separately.
            chunks: 'initial',
          },
        },
      },
    },
  };
};

/* eslint-enable @typescript-eslint/naming-convention */

export default getCommonConfiguration;
