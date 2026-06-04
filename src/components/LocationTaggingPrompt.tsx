import React, {useState} from 'react';
import {Alert} from 'react-native';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import * as Preferences from '@userActions/Preferences';
import checkPermission from '@libs/Permissions/checkPermission';
import requestPermission from '@libs/Permissions/requestPermission';
import ConfirmModal from './ConfirmModal';

/**
 * One-time soft-ask shown at live-session start offering to enable location
 * tagging. Appears at most once per account: once the user answers (either
 * button), `location_prompt_seen` is persisted and the prompt never auto-shows
 * again — the Settings → Privacy toggle remains the only way back in.
 *
 * Mounting this component IS the "live session" gate; it should only be
 * rendered from the live-session screen.
 */
function LocationTaggingPrompt() {
  const {translate} = useLocalize();
  const preferences = useCurrentUserPreferences();

  const [dismissed, setDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Eligible only when the user has never been asked and tagging isn't already
  // on (the latter covers a user who enabled it in Settings on another device).
  const isEligible =
    preferences?.location_prompt_seen !== true &&
    preferences?.track_location_during_sessions !== true;
  const isVisible = isEligible && !dismissed;

  const onConfirm = () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    // requestPermission alerts + deep-links to Settings itself on a hard denial.
    // Never persist tagging as enabled without the OS grant, but always record
    // that the prompt was answered so it won't reappear.
    checkPermission('location')
      .then(allowed => (allowed ? true : requestPermission('location')))
      .then(isGranted =>
        Preferences.updatePreferences({
          location_prompt_seen: true,
          ...(isGranted ? {track_location_during_sessions: true} : {}),
        }),
      )
      .then(() => setDismissed(true))
      .catch(error => {
        // Leave the modal open so the user can retry; mirror PrivacyScreen.
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('privacyScreen.error.save'), errorMessage);
      })
      .finally(() => setIsSubmitting(false));
  };

  const onCancel = () => {
    setDismissed(true);
    Preferences.updatePreferences({location_prompt_seen: true}).catch(() => {
      // Best-effort: if persisting "seen" fails (e.g. offline write error),
      // the prompt may reappear on a future live session, which is acceptable.
    });
  };

  return (
    <ConfirmModal
      title={translate('locationPrompt.title')}
      prompt={translate('locationPrompt.prompt')}
      confirmText={translate('locationPrompt.enable')}
      cancelText={translate('locationPrompt.notNow')}
      isVisible={isVisible}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

LocationTaggingPrompt.displayName = 'LocationTaggingPrompt';
export default LocationTaggingPrompt;
