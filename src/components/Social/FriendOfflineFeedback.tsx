import React, {useCallback} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import * as Friends from '@userActions/Friends';
import ONYXKEYS from '@src/ONYXKEYS';
import type {FriendsMetadata} from '@src/types/onyx';
import type ChildrenProps from '@src/types/utils/ChildrenProps';

type FriendOfflineFeedbackProps = ChildrenProps & {
  /** The counterpart user's ID whose pending friend action is reflected */
  userID: string;

  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps a friend row in OfflineWithFeedback, sourcing the pending/error state
 * for that counterpart from FRIENDS_METADATA and wiring up error dismissal.
 */
function FriendOfflineFeedback({
  userID,
  style,
  children,
}: FriendOfflineFeedbackProps) {
  const selector = useCallback(
    (data: OnyxEntry<FriendsMetadata>) => data?.[userID],
    [userID],
  );
  const [metadata] = useOnyx(ONYXKEYS.FRIENDS_METADATA, {selector});

  const pendingAction = metadata?.pendingAction;
  const onClose = useCallback(
    () => Friends.clearFriendActionError(userID, pendingAction ?? null),
    [userID, pendingAction],
  );

  return (
    <OfflineWithFeedback
      pendingAction={pendingAction}
      errors={metadata?.errors}
      onClose={onClose}
      style={style}>
      {children}
    </OfflineWithFeedback>
  );
}

FriendOfflineFeedback.displayName = 'FriendOfflineFeedback';

export default FriendOfflineFeedback;
