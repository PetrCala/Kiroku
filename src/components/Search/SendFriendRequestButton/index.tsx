import React from 'react';
import {View} from 'react-native';
import CONST from '@src/CONST';
import * as ErrorUtils from '@libs/ErrorUtils';
import Button from '@components/Button';
import useThemeStyles from '@hooks/useThemeStyles';
import Text from '@components/Text';
import * as Friends from '@userActions/Friends';
import type {TranslationPaths} from '@src/languages/types';
import ERRORS from '@src/ERRORS';
import useLocalize from '@hooks/useLocalize';
import useCurrentUserData from '@hooks/useCurrentUserData';
import {isBlocked} from '@libs/BlockUtils';
import type SendFriendRequestButtonProps from './types';

function SendFriendRequestButton({
  userFrom,
  userTo,
  requestStatus,
  alreadyAFriend,
}: SendFriendRequestButtonProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const userData = useCurrentUserData();
  // Discovery filter (#759): if the signed-in user has blocked this user, never
  // offer the send/accept-request action. The server rejects the write either
  // way; this keeps the UI from offering it. Blocked users are normally filtered
  // out of the lists upstream, so this is a defensive fallback.
  const isUserBlocked = isBlocked(userData?.blocked, userTo);

  const handleSendRequestPress = () => {
    (async (): Promise<void> => {
      try {
        setIsLoading(true);
        Friends.sendFriendRequest(userTo);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.USER.FRIEND_REQUEST_SEND_FAILED, error);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const handleAcceptFriendRequestPress = () => {
    (async (): Promise<void> => {
      try {
        setIsLoading(true);
        Friends.acceptFriendRequest(userTo);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.USER.FRIEND_REQUEST_SEND_FAILED, error);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const renderText = (translationKey: TranslationPaths) => {
    return (
      <Text numberOfLines={1} style={styles.textNormalThemeText}>
        {translate(translationKey)}
      </Text>
    );
  };

  const renderButton = (
    translationKey: TranslationPaths,
    onPress: () => void,
  ) => {
    return (
      <Button
        add
        onPress={onPress}
        text={translate(translationKey)}
        isLoading={isLoading}
      />
    );
  };

  const renderContents = () => {
    if (userFrom === userTo) {
      return renderText('searchResult.self');
    }
    if (isUserBlocked) {
      return renderText('searchResult.blocked');
    }
    if (alreadyAFriend) {
      return renderText('searchResult.friend');
    }
    if (requestStatus === CONST.FRIEND_REQUEST_STATUS.SENT) {
      return renderText('searchResult.sent');
    }
    if (requestStatus === CONST.FRIEND_REQUEST_STATUS.RECEIVED) {
      return renderButton(
        'searchResult.accept',
        handleAcceptFriendRequestPress,
      );
    }
    return renderButton('searchResult.add', handleSendRequestPress);
  };

  return (
    <View style={[styles.flexRow, styles.alignItemsCenter]}>
      {renderContents()}
    </View>
  );
}

export default SendFriendRequestButton;
