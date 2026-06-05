import {AppRegistry} from 'react-native';
import DateUtils from '@libs/DateUtils';
import Config from '@src/CONFIG';

/**
 * Web entry point. The native platforms render via `AppRegistry.registerComponent` (called in
 * index.js), but on web we must explicitly run the registered application into the `#root` DOM
 * node created by web/index.html.
 */
export default function () {
  AppRegistry.runApplication(Config.APP_NAME, {
    rootTag: document.getElementById('root'),
  });

  // Keep the "current date" in sync so date-dependent UI updates across midnight / resume.
  DateUtils.startCurrentDateUpdater();
}
