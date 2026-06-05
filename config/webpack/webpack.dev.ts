/* eslint-disable @typescript-eslint/naming-convention */
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import path from 'path';
import portfinder from 'portfinder';
import type {Configuration} from 'webpack';
import {DefinePlugin} from 'webpack';
import type {Configuration as DevServerConfiguration} from 'webpack-dev-server';
import {merge} from 'webpack-merge';
import type Environment from './types';
import getCommonConfiguration from './webpack.common';

const BASE_PORT = 8082;

/**
 * Configuration for the local web dev server.
 *
 * Trimmed vs. Expensify upstream: no HTTPS/cert setup, no API proxy (Kiroku web has no
 * local proxy yet), and no TimeAnalytics/ForceGarbageCollection perf plugins. Serves plain
 * HTTP on localhost with HMR via react-refresh.
 */
const getConfiguration = (environment: Environment): Promise<Configuration> =>
  portfinder.getPortPromise({port: BASE_PORT}).then(port => {
    const baseConfig = getCommonConfiguration(environment);

    const devServer: DevServerConfiguration = {
      static: {
        directory: path.join(__dirname, '../../dist'),
      },
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
      hot: true,
      historyApiFallback: true,
      port,
    };

    const config = merge(baseConfig, {
      mode: 'development',
      devtool: 'eval-source-map',
      devServer,
      plugins: [
        new DefinePlugin({
          'process.env.PORT': port,
          'process.env.NODE_ENV': JSON.stringify('development'),
        }),
        new ReactRefreshWebpackPlugin(),
      ],
      cache: {
        type: 'filesystem',
        name: environment.platform ?? 'default',
        buildDependencies: {
          // webpack and loaders are build dependencies by default; this also makes all
          // dependencies of this config file build dependencies. Include babel.config.js
          // so the filesystem cache invalidates when the babel transform config changes.
          config: [__filename, path.join(__dirname, '../../babel.config.js')],
        },
      },
      snapshot: {
        // Paths webpack trusts won't be modified while it's running. Onyx can be edited on the
        // fly during development; everything else under node_modules is treated as immutable.
        managedPaths: [/([\\/]node_modules[\\/](?!react-native-onyx))/],
      },
    });

    return config;
  });

export default getConfiguration;
