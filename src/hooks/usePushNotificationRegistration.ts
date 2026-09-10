import {useEffect} from 'react';
import PushNotification from '@libs/Notification/PushNotification';
import * as PushNotificationActions from '@userActions/PushNotification';

/**
 * Register this device with kiroku-api on sign-in (mount) and again whenever
 * FCM rotates the token. Registration itself is a no-op until the OS
 * permission is granted, so this never prompts.
 */
function usePushNotificationRegistration() {
  useEffect(() => {
    PushNotificationActions.registerDevice();
    return PushNotification.onTokenRefresh(() => {
      PushNotificationActions.registerDevice();
    });
  }, []);
}

export default usePushNotificationRegistration;
