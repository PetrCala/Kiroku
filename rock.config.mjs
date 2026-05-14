import {platformAndroid} from '@rock-js/platform-android';
import {platformIOS} from '@rock-js/platform-ios';
import {pluginMetro} from '@rock-js/plugin-metro';
import {providerGitHub} from '@rock-js/provider-github';

/** @type {import('@rock-js/config').Config} */
export default {
  remoteCacheProvider: providerGitHub(),
  bundler: pluginMetro(),
  platforms: {
    ios: platformIOS({sourceDir: './ios'}),
    android: platformAndroid({sourceDir: './android'}),
  },
  fingerprint: {
    extraSources: ['ios/Podfile', 'android/build.gradle', 'package.json'],
    env: ['APP_ENV'],
  },
};
