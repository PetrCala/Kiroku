import {platformAndroid} from '@rock-js/platform-android';
import {platformIOS} from '@rock-js/platform-ios';
import {pluginMetro} from '@rock-js/plugin-metro';

/** @type {import('@rock-js/config').Config} */
export default {
    bundler: pluginMetro(),
    platforms: {
        ios: platformIOS({sourceDir: './ios'}),
        android: platformAndroid({sourceDir: './android'}),
    },
};
