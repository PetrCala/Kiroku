/**
 * iOS live-session surface: the ActivityKit Live Activity, through the native
 * `LiveActivityBridge` module (ios/kiroku/LiveActivityBridge.swift).
 *
 * The module is absent under jest (the react-native mock has no NativeModules)
 * and could be absent in a build that somehow shipped without the extension,
 * hence the optional chain and the no-op fallback. Availability of ActivityKit
 * itself is checked natively, not here: iOS 16.1 and older, and a user who
 * turned Live Activities off, both end in the same quiet no-op.
 */
import {NativeEventEmitter, NativeModules} from 'react-native';
import type {
  LiveActivityModule,
  LiveActivityNativeModule,
  LiveActivityPushToken,
} from './types';

const PUSH_TOKEN_EVENT = 'liveActivityPushToken';

const bridge: LiveActivityNativeModule | undefined =
  NativeModules?.LiveActivityBridge;

// One emitter for the module, created once. Constructing it per subscription
// would register a duplicate listener set on the native side.
const emitter = bridge ? new NativeEventEmitter(bridge) : undefined;

const LiveActivity: LiveActivityModule = {
  start: payload => bridge?.start(payload),
  update: payload => bridge?.update(payload),
  end: payload => bridge?.end(payload),
  subscribeToPushToken: listener => {
    const subscription = emitter?.addListener(
      PUSH_TOKEN_EVENT,
      (pushToken: LiveActivityPushToken) => listener(pushToken),
    );
    return () => subscription?.remove();
  },
};

export default LiveActivity;
