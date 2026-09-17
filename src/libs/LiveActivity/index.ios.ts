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
import {NativeModules} from 'react-native';
import type {LiveActivityModule} from './types';

const bridge: LiveActivityModule | undefined =
  NativeModules?.LiveActivityBridge;

const LiveActivity: LiveActivityModule = {
  start: payload => bridge?.start(payload),
  update: payload => bridge?.update(payload),
  end: payload => bridge?.end(payload),
};

export default LiveActivity;
