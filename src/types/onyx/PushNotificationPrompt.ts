/** State of the one-time soft ask for push notification permission. */
type PushNotificationPrompt = {
  /** Set after an action that makes notifications worth asking about (sending a friend request) */
  shouldShow?: boolean;

  /** True once the user answered the soft ask; it is never shown again after that */
  hasBeenShown?: boolean;
};

export default PushNotificationPrompt;
