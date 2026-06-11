import React, {useEffect, useMemo, useState} from 'react';
import {BackHandler, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ProfileImage from '@components/ProfileImage';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import Text from '@components/Text';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import getPlatform from '@libs/getPlatform';
import CONST from '@src/CONST';
import {unblockUser} from '@userActions/Block';
import ONYXKEYS from '@src/ONYXKEYS';

function BlockedUsersScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  // The signed-in user's own outbound block list lives on their own record,
  // server-hydrated via app/open + /v1/updates (see Block.ts / UserData.blocked).
  const currentUserData = useCurrentUserData();
  // Profiles of other users are best-effort cache only. We deliberately do NOT
  // fetch them: every cross-user profile read is block-gated server-side (it
  // returns `profile: null`), so a fetch would evict the row's name/avatar
  // rather than populate it. We render whatever is already cached and fall back
  // to a placeholder otherwise (a dedicated minimal-profile read for blocked
  // uids is a kiroku-api follow-up).
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);

  // `unblockUser` is fire-and-forget with no optimistic Onyx data (the blocked
  // list is server-authoritative). Hide the row immediately so the unblock
  // feels responsive; the server's /v1/updates push then drops it from `blocked`
  // for good.
  const [locallyUnblocked, setLocallyUnblocked] = useState<
    Record<string, boolean>
  >({});

  const blocked = currentUserData?.blocked;
  const blockedUserIDs = useMemo(
    () =>
      Object.keys(blocked ?? {}).filter(
        uid => blocked?.[uid] && !locallyUnblocked[uid],
      ),
    [blocked, locallyUnblocked],
  );

  const onUnblock = (uid: string) => {
    setLocallyUnblocked(prev => ({...prev, [uid]: true}));
    unblockUser(uid);
  };

  // Match PrivacyScreen: route the Android hardware back press through the
  // app's navigation stack rather than the OS default.
  useEffect(() => {
    // BackHandler is native-only; on web it warns and no-ops, so skip it.
    if (getPlatform() === CONST.PLATFORM.WEB) {
      return;
    }
    const backAction = () => {
      Navigation.goBack();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ScreenWrapper testID={BlockedUsersScreen.displayName}>
      <HeaderWithBackButton
        title={translate('blockedUsersScreen.title')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      {blockedUserIDs.length === 0 ? (
        <View
          style={[
            styles.flex1,
            styles.alignItemsCenter,
            styles.justifyContentCenter,
            styles.ph5,
          ]}>
          <Text
            style={[styles.textHeadline, styles.textAlignCenter, styles.mb2]}>
            {translate('blockedUsersScreen.emptyList.title')}
          </Text>
          <Text style={[styles.textSupporting, styles.textAlignCenter]}>
            {translate('blockedUsersScreen.emptyList.subtitle')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.w100]}>
          <Text
            style={[styles.textSupporting, styles.ph5, styles.mt3, styles.mb2]}>
            {translate('blockedUsersScreen.unblockNote')}
          </Text>
          <Section
            title=""
            containerStyles={styles.ph0}
            childrenStyles={styles.pt3}>
            {blockedUserIDs.map(uid => {
              // Block-gated reads return no profile, so a blocked uid usually
              // has only a stale cache or nothing at all. Fall back to a generic
              // label when the (required) display name isn't cached.
              const profile = userDataList?.[uid]?.profile;
              const displayName =
                profile?.display_name ??
                translate('blockedUsersScreen.unknownUser');
              return (
                <View
                  key={uid}
                  style={[
                    styles.flexRow,
                    styles.alignItemsCenter,
                    styles.justifyContentBetween,
                    styles.ph5,
                    styles.pv2,
                  ]}>
                  <View
                    style={[
                      styles.flexRow,
                      styles.alignItemsCenter,
                      styles.flex1,
                      styles.mr3,
                    ]}>
                    <ProfileImage
                      photoUrl={profile?.photo_url}
                      style={styles.avatarMedium}
                    />
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.ml3, styles.flex1, styles.textNormal]}>
                      {displayName}
                    </Text>
                  </View>
                  <Button
                    small
                    text={translate('blockedUsersScreen.unblock')}
                    onPress={() => onUnblock(uid)}
                  />
                </View>
              );
            })}
          </Section>
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

BlockedUsersScreen.displayName = 'BlockedUsersScreen';
export default BlockedUsersScreen;
