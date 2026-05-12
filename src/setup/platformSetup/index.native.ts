import crashlytics from '@react-native-firebase/crashlytics';
import CONFIG from '@src/CONFIG';

/* eslint-disable rulesdir/prefer-early-return */

export default function () {
  if (!CONFIG.SEND_CRASH_REPORTS) {
    crashlytics().setCrashlyticsCollectionEnabled(false);
  }
}
