import {useEffect} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';
import * as LiveActivityActions from '@userActions/LiveActivity';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Config} from '@src/types/onyx';
import useCurrentUserPreferences from './useCurrentUserPreferences';
import useFeatureFlag from './useFeatureFlag';
import useLocalize from './useLocalize';

const autoCloseDefaultSelector = (config: OnyxEntry<Config>) =>
  config?.auto_close_default_hours;

/**
 * Mirror the live session onto the lock screen (Sessions v2 RFC §8): the iOS
 * Live Activity, and the Android ongoing notification once that lands.
 *
 * Driven by observing the ongoing session in Onyx rather than by hooking the
 * session writes. W2 is rewriting that write path onto ops, and a surface fed
 * by observed state cannot miss a write it has not been taught about.
 *
 * Turning the feature flag off reads as "no live session", so a kill switch
 * clears the lock screen within seconds instead of at the next app launch.
 */
function useLiveActivity(): void {
  const isEnabled = useFeatureFlag('LIVE_SESSION_LOCK_SCREEN');
  const [ongoingSession] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const preferences = useCurrentUserPreferences();
  const {translate} = useLocalize();
  const [autoCloseDefaultHours] = useOnyx(ONYXKEYS.CONFIG, {
    selector: autoCloseDefaultSelector,
    canBeMissing: true,
  });
  const drinksToUnits = preferences?.drinks_to_units;
  const autoClosePreference = preferences?.auto_close_sessions_after_hours;

  useEffect(() => {
    LiveActivityActions.sync({
      session: isEnabled ? ongoingSession : undefined,
      drinksToUnits,
      translate,
      autoClosePreference,
      autoCloseDefaultHours,
    });
  }, [
    isEnabled,
    ongoingSession,
    drinksToUnits,
    translate,
    autoClosePreference,
    autoCloseDefaultHours,
  ]);

  // iOS hands the running activity's push token back asynchronously and may
  // rotate it, so follow it for as long as the user is signed in. A no-op
  // everywhere else.
  useEffect(() => LiveActivityActions.watchPushToken(), []);

  // Sign-out unmounts the authenticated tree; clear the lock screen with it
  // rather than waiting for Onyx to empty.
  useEffect(() => () => LiveActivityActions.stop(), []);
}

export default useLiveActivity;
