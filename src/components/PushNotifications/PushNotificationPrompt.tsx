import React from 'react';
import {useOnyx} from 'react-native-onyx';
import ConfirmModal from '@components/ConfirmModal';
import useLocalize from '@hooks/useLocalize';
import * as PushNotificationActions from '@userActions/PushNotification';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * The soft ask shown before the system permission prompt. It appears once,
 * right after the user's first friend request (see
 * `PushNotificationActions.requestPromptIfNeeded`), so the system prompt only
 * shows up when the user already said yes and knows what it's for.
 */
function PushNotificationPrompt() {
  const {translate} = useLocalize();
  const [prompt] = useOnyx(ONYXKEYS.PUSH_NOTIFICATION_PROMPT);
  const isVisible = !!prompt?.shouldShow && !prompt?.hasBeenShown;

  return (
    <ConfirmModal
      isVisible={isVisible}
      title={translate('pushNotificationPrompt.title')}
      prompt={translate('pushNotificationPrompt.prompt')}
      confirmText={translate('pushNotificationPrompt.confirm')}
      cancelText={translate('pushNotificationPrompt.cancel')}
      onConfirm={() => {
        PushNotificationActions.answerPrompt(true);
      }}
      onCancel={() => {
        PushNotificationActions.answerPrompt(false);
      }}
    />
  );
}

PushNotificationPrompt.displayName = 'PushNotificationPrompt';

export default PushNotificationPrompt;
