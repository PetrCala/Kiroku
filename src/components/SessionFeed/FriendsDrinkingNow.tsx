import React from 'react';
import {View} from 'react-native';
import {PressableWithFeedback} from '@components/Pressable';
import ProfileImage from '@components/ProfileImage';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useFriendsData from '@hooks/useFriendsData';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {filterBlockedUsers} from '@libs/BlockUtils';
import {objKeys} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {UserID} from '@src/types/onyx/OnyxCommon';

const LIVE_DOT_SIZE = 8;

/**
 * The friends whose latest session is live right now, from their `user_status`
 * (RFC §10): a row of avatars above the feed, each opening that friend's
 * profile. Renders nothing when nobody is, so the feed sits directly under the
 * calendar most of the time.
 *
 * A friend's status is what the server mirrors on their session writes, so a
 * session they never closed would read as live forever; the same expiry the
 * friend list applies (`sessionIsExpired`) keeps a stale flag off this row.
 */
function FriendsDrinkingNow() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const userData = useCurrentUserData();
  // Straight off the signed-in user's record each render, like the friend
  // list: the React Compiler memoises it, and a copy in state would lag.
  const friends = filterBlockedUsers(
    objKeys(userData?.friends),
    userData?.blocked,
  );
  const {profileList, userStatusList} = useFriendsData(friends);

  const drinkingNow: UserID[] = friends.filter(userID => {
    const latestSession = userStatusList[userID]?.latest_session;
    return !!latestSession?.ongoing && !DSUtils.sessionIsExpired(latestSession);
  });

  if (drinkingNow.length === 0) {
    return null;
  }

  return (
    <View style={styles.mb3} testID="friends-drinking-now">
      <View style={[styles.flexRow, styles.alignItemsCenter, styles.mb2]}>
        <View
          style={[
            styles.mr2,
            {
              width: LIVE_DOT_SIZE,
              height: LIVE_DOT_SIZE,
              borderRadius: LIVE_DOT_SIZE / 2,
              backgroundColor: theme.danger,
            },
          ]}
        />
        <Text style={[styles.textLabelSupporting, styles.textStrong]}>
          {translate('homeScreen.feed.friendsDrinkingNow', {
            count: drinkingNow.length,
          })}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {drinkingNow.map(userID => {
          const profile = profileList[userID];
          const name = profile?.display_name ?? '';
          return (
            <PressableWithFeedback
              key={userID}
              accessibilityLabel={translate('homeScreen.feed.friendA11y', {
                displayName: name,
              })}
              accessibilityRole={CONST.ROLE.BUTTON}
              onPress={() =>
                Navigation.navigate(ROUTES.PROFILE.getRoute(userID))
              }
              style={[styles.alignItemsCenter, styles.mr3]}
              testID={`friend-drinking-now-${userID}`}>
              <ProfileImage
                photoUrl={profile?.photo_url}
                style={styles.avatarMedium}
              />
              <Text
                style={[styles.textMicroSupporting, styles.mt1]}
                numberOfLines={1}>
                {name}
              </Text>
            </PressableWithFeedback>
          );
        })}
      </ScrollView>
    </View>
  );
}

FriendsDrinkingNow.displayName = 'FriendsDrinkingNow';
export default FriendsDrinkingNow;
