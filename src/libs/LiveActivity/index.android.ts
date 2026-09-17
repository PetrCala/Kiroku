/**
 * Android live-session surface: the ongoing notification, through the native
 * `LiveSessionNotification` module
 * (android/.../liveactivity/LiveSessionNotificationModule.java).
 *
 * Same contract as the iOS fork: fire and forget, no-op when the module is
 * absent (jest). Whether notifications are permitted is checked natively, so
 * a user who denied the Android 13+ POST_NOTIFICATIONS prompt simply sees
 * nothing.
 */
import {NativeModules} from 'react-native';
import type {LiveActivityModule} from './types';

const notification: LiveActivityModule | undefined =
  NativeModules?.LiveSessionNotification;

const LiveActivity: LiveActivityModule = {
  start: payload => notification?.start(payload),
  update: payload => notification?.update(payload),
  end: payload => notification?.end(payload),
};

export default LiveActivity;
