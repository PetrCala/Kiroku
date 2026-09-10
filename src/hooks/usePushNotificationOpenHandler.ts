import {useEffect} from 'react';
import PushNotification from '@libs/Notification/PushNotification';
import * as PushNotificationActions from '@userActions/PushNotification';

/**
 * Open the deep link of a tapped notification: the one that launched the app
 * from a quit state (once per process), and any tapped while backgrounded.
 */
function usePushNotificationOpenHandler() {
  useEffect(() => {
    PushNotificationActions.openInitialNotification();
    return PushNotification.onNotificationOpened(
      PushNotificationActions.openNotification,
    );
  }, []);
}

export default usePushNotificationOpenHandler;
