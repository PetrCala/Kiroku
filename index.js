/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import CONFIG from './src/CONFIG';
import PushNotification from './src/libs/Notification/PushNotification';
import additionalAppSetup from './src/setup';

// FCM needs its headless handler registered before the app component, outside
// React (no-op on web).
PushNotification.registerBackgroundHandler();

AppRegistry.registerComponent(CONFIG.APP_NAME, () => App);
additionalAppSetup();
