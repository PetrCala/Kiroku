import {useCallback, useEffect, useState} from 'react';
import {AppState} from 'react-native';
import PushNotification from '@libs/Notification/PushNotification';
import type {PushPermissionStatus} from '@libs/Notification/PushNotification/types';

/**
 * The OS notification permission, re-read whenever the app returns to the
 * foreground (the user may have flipped it in the system settings) and on
 * demand via `refresh`. Undefined until the first read resolves.
 */
function usePushPermissionStatus() {
  const [status, setStatus] = useState<PushPermissionStatus>();

  const refresh = useCallback(() => {
    PushNotification.getPermissionStatus()
      .then(setStatus)
      .catch(() => setStatus('unavailable'));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  return {status, refresh};
}

export default usePushPermissionStatus;
