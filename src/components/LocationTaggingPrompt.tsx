import React, {useEffect, useState} from 'react';
import {Alert} from 'react-native';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import * as Preferences from '@userActions/Preferences';
import canRequestPermission from '@libs/Permissions/canRequestPermission';
import requestPermission from '@libs/Permissions/requestPermission';
import ConfirmModal from './ConfirmModal';

/**
 * One-time explainer shown at live-session start, right before the OS location
 * permission dialog. Appears at most once per account: once answered,
 * `location_prompt_seen` is persisted and the prompt never auto-shows again.
 * The Settings → Privacy toggle remains the way to change it later.
 *
 * App Review (Guideline 5.1.1) requires a pre-permission message to always lead
 * to the system dialog. So it has a single neutral "Continue" button, can't be
 * dismissed any other way, and only shows while the OS can still ask.
 *
 * Mounting this component IS the "live session" gate; it should only be
 * rendered from the live-session screen.
 */
function LocationTaggingPrompt() {
  const {translate} = useLocalize();
  const preferences = useCurrentUserPreferences();

  const [canRequest, setCanRequest] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Eligible only when the user has never been asked and tagging isn't already
  // on (the latter covers a user who enabled it in Settings on another device).
  const isEligible =
    preferences?.location_prompt_seen !== true &&
    preferences?.track_location_during_sessions !== true;

  useEffect(() => {
    if (!isEligible) {
      return;
    }
    let isCancelled = false;
    canRequestPermission('location')
      .then(result => {
        if (!isCancelled) {
          setCanRequest(result);
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [isEligible]);

  const isVisible = isEligible && canRequest && !dismissed;

  const onContinue = () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    // Skip the "open Settings" alert on denial: tagging is optional, and
    // "Don't Allow" is an answer to respect. Tagging is only ever enabled with
    // the OS grant, and the prompt is marked answered either way.
    requestPermission('location', {shouldAlertOnDenial: false})
      .then(isGranted =>
        Preferences.updatePreferences({
          location_prompt_seen: true,
          ...(isGranted ? {track_location_during_sessions: true} : {}),
        }),
      )
      .catch(error => {
        // The modal has no other way out, so close it anyway. The OS has
        // recorded the answer, so the prompt won't show again.
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('privacyScreen.error.save'), errorMessage);
      })
      .finally(() => {
        setDismissed(true);
        setIsSubmitting(false);
      });
  };

  // No onCancel and no cancel button: backdrop taps, swipes and the back button
  // fall through to ConfirmModal's no-op, so the only way on is Continue.
  return (
    <ConfirmModal
      title={translate('locationPrompt.title')}
      prompt={translate('locationPrompt.prompt')}
      confirmText={translate('common.continue')}
      shouldShowCancelButton={false}
      isVisible={isVisible}
      onConfirm={onContinue}
    />
  );
}

LocationTaggingPrompt.displayName = 'LocationTaggingPrompt';
export default LocationTaggingPrompt;
