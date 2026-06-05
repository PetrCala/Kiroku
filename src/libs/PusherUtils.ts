import type {OnyxUpdate} from 'react-native-onyx';
import CONST from '@src/CONST';
import type {OnyxUpdatesFromServer} from '@src/types/onyx';
import Log from './Log';
import NetworkConnection from './NetworkConnection';
import * as Pusher from './Pusher/pusher';

type Callback = (data: OnyxUpdate[]) => Promise<void>;

// Keeps track of all the callbacks that need triggered for each event type
const multiEventCallbackMapping: Record<string, Callback> = {};

function subscribeToMultiEvent(eventType: string, callback: Callback) {
  multiEventCallbackMapping[eventType] = callback;
}

function triggerMultiEventHandler(
  eventType: string,
  data: OnyxUpdate[],
): Promise<void> {
  if (!multiEventCallbackMapping[eventType]) {
    return Promise.resolve();
  }
  return multiEventCallbackMapping[eventType](data);
}

/**
 * Abstraction around subscribing to private user channel events. Handles all logs and errors automatically.
 */
function subscribeToPrivateUserChannelEvent(
  eventName: string,
  userID: string,
  onEvent: (pushJSON: OnyxUpdatesFromServer) => void,
) {
  // Must equal the server's channel exactly: kiroku-api authorizes/publishes to
  // `private-user-<uid>` with no environment suffix (dev/prod are separate apps).
  const pusherChannelName =
    `${CONST.PUSHER.PRIVATE_USER_CHANNEL_PREFIX}${userID}` as const;

  function logPusherEvent(pushJSON: OnyxUpdatesFromServer) {
    Log.info(
      `[Report] Handled ${eventName} event sent by Pusher`,
      false,
      pushJSON,
    );
  }

  function onPusherResubscribeToPrivateUserChannel() {
    NetworkConnection.triggerReconnectionCallbacks(
      'Pusher re-subscribed to private user channel',
    );
  }

  function onEventPush(pushJSON: OnyxUpdatesFromServer) {
    logPusherEvent(pushJSON);
    onEvent(pushJSON);
  }

  function onSubscriptionFailed(error: Error) {
    Log.hmmm('Failed to subscribe to Pusher channel', {
      error,
      pusherChannelName,
      eventName,
    });
  }
  Pusher.subscribe(
    pusherChannelName,
    eventName,
    onEventPush,
    onPusherResubscribeToPrivateUserChannel,
  ).catch(onSubscriptionFailed);
}

/**
 * Abstraction around subscribing to a public Pusher channel event. Unlike
 * `subscribeToPrivateUserChannelEvent`, the channel name carries no
 * `private-`/`presence-` prefix, so Pusher subscribes without hitting the auth
 * endpoint — used for global broadcasts (e.g. app config) that aren't scoped to
 * a single user, hence there's no reconnect-callback coupling either.
 */
function subscribeToPublicChannelEvent<TEventData>(
  channelName: string,
  eventName: string,
  onEvent: (eventData: TEventData) => void,
) {
  function onEventPush(eventData: TEventData) {
    Log.info(
      `[Pusher] Handled ${eventName} event on public channel ${channelName}`,
      false,
      eventData as Record<string, unknown>,
    );
    onEvent(eventData);
  }

  function onSubscriptionFailed(error: Error) {
    Log.hmmm('[Pusher] Failed to subscribe to public channel', {
      error,
      channelName,
      eventName,
    });
  }

  Pusher.subscribe(
    channelName,
    eventName,
    onEventPush as (data: unknown) => void,
  ).catch(onSubscriptionFailed);
}

export default {
  subscribeToPrivateUserChannelEvent,
  subscribeToPublicChannelEvent,
  subscribeToMultiEvent,
  triggerMultiEventHandler,
};
