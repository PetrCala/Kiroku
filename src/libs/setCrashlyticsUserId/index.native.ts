import crashlytics from '@react-native-firebase/crashlytics';

const setCrashlyticsUserId = (accountID: string | number) => {
  crashlytics().setUserId(String(accountID));
};

export default setCrashlyticsUserId;
