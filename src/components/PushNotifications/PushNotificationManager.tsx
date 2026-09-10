import React from 'react';
import usePushNotificationOpenHandler from '@hooks/usePushNotificationOpenHandler';
import usePushNotificationRegistration from '@hooks/usePushNotificationRegistration';
import PushNotificationBanner from './PushNotificationBanner';
import PushNotificationPrompt from './PushNotificationPrompt';

/**
 * Everything push-related that lives while a user is signed in. Mounted by
 * `AuthScreens`, so it starts on sign-in and tears down on sign-out:
 * device registration + token refresh, notification taps, the foreground
 * banner, and the one-time soft ask.
 */
function PushNotificationManager() {
  usePushNotificationRegistration();
  usePushNotificationOpenHandler();

  return (
    <>
      <PushNotificationPrompt />
      <PushNotificationBanner />
    </>
  );
}

PushNotificationManager.displayName = 'PushNotificationManager';

export default PushNotificationManager;
