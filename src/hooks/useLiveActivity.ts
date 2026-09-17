import {useEffect} from 'react';
import {useOnyx} from 'react-native-onyx';
import * as LiveActivityActions from '@userActions/LiveActivity';
import ONYXKEYS from '@src/ONYXKEYS';
import useCurrentUserPreferences from './useCurrentUserPreferences';
import useFeatureFlag from './useFeatureFlag';
import useLocalize from './useLocalize';

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
  const drinksToUnits = preferences?.drinks_to_units;

  useEffect(() => {
    LiveActivityActions.sync({
      session: isEnabled ? ongoingSession : undefined,
      drinksToUnits,
      translate,
    });
  }, [isEnabled, ongoingSession, drinksToUnits, translate]);

  // Sign-out unmounts the authenticated tree; clear the lock screen with it
  // rather than waiting for Onyx to empty.
  useEffect(() => () => LiveActivityActions.stop(), []);
}

export default useLiveActivity;
