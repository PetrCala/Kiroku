import React from 'react';
import {StyleSheet, View} from 'react-native';
import Button from '@components/Button';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';

type NoFriendInfoProps = {
  /** Headline; defaults to "No friends yet" */
  title?: string;
};

const localStyles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 360,
  },
});

/**
 * Empty state for the friend list and the empty Friend Requests tab: a
 * headline, one plain line, and both ways to add someone. Each opens the Add
 * friends hub on the matching tab.
 */
function NoFriendInfo({title}: NoFriendInfoProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  return (
    <View style={[styles.fullScreenCenteredContent, styles.ph5]}>
      <View style={[styles.alignItemsCenter, localStyles.content]}>
        <Text style={[styles.textHeadlineH1, styles.textAlignCenter]}>
          {title ?? translate('socialScreen.noFriendsYet')}
        </Text>
        <Text
          style={[
            styles.textNormal,
            styles.textSupporting,
            styles.textAlignCenter,
            styles.mt2,
          ]}>
          {translate('socialScreen.noFriendsYetDetail')}
        </Text>
        <Button
          large
          success
          text={translate('socialScreen.inviteFriends')}
          onPress={() =>
            Navigation.navigate(
              ROUTES.SOCIAL_ADD_FRIENDS.getRoute(CONST.ADD_FRIENDS_TAB.CODE),
            )
          }
          style={[styles.w100, styles.mt5]}
        />
        <Button
          text={translate('socialScreen.searchByName')}
          onPress={() =>
            Navigation.navigate(
              ROUTES.SOCIAL_ADD_FRIENDS.getRoute(CONST.ADD_FRIENDS_TAB.SEARCH),
            )
          }
          style={[styles.bgTransparent, styles.mt3]}
          textStyles={styles.link}
        />
      </View>
    </View>
  );
}

NoFriendInfo.displayName = 'NoFriendInfo';
export default NoFriendInfo;
