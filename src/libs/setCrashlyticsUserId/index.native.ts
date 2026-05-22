import {getCrashlytics, setUserId} from '@react-native-firebase/crashlytics';

const setCrashlyticsUserId = (accountID: string | number) => {
  setUserId(getCrashlytics(), String(accountID));
};

export default setCrashlyticsUserId;
