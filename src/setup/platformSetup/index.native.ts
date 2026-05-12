import crashlytics from '@react-native-firebase/crashlytics';
import perf from '@react-native-firebase/perf';
import CONFIG from '@src/CONFIG';

/* eslint-disable rulesdir/prefer-early-return */

export default function () {
  if (!CONFIG.SEND_CRASH_REPORTS) {
    crashlytics().setCrashlyticsCollectionEnabled(false);
    perf().setPerformanceCollectionEnabled(false);
  }
}
