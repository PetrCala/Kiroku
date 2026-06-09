import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import SearchWindow from '@components/Social/SearchWindow';
import type {UserIDToNicknameMapping} from '@src/types/various/Search';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {objKeys} from '@libs/DataHandling';
import {getNicknameMapping, searchArrayByText} from '@libs/Search';
import useCurrentUserData from '@hooks/useCurrentUserData';
import type {UserArray} from '@src/types/onyx/OnyxCommon';
import Text from '@components/Text';
import * as ErrorUtils from '@libs/ErrorUtils';
import UserListComponent from '@components/Social/UserListComponent';
import useFriendsData from '@hooks/useFriendsData';
import useNetwork from '@hooks/useNetwork';
import NoFriendInfo from '@components/Social/NoFriendInfo';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import ERRORS from '@src/ERRORS';
import getFriendListContentState from './getFriendListContentState';

function FriendListScreen() {
  const userData = useCurrentUserData();
  const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
  const {isOffline} = useNetwork();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const [friends, setFriends] = useState<UserArray>([]);
  const [friendsToDisplay, setFriendsToDisplay] = useState<UserArray>([]);
  const [userHasFriends, setUserHasFriends] = useState<boolean>(false);
  const {
    profileList,
    userStatusList,
    isLoading: isLoadingFriends,
  } = useFriendsData(friends);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const localSearch = useCallback(
    (searchText: string): void => {
      try {
        setIsSearching(true);
        const searchMapping: UserIDToNicknameMapping = getNicknameMapping(
          profileList,
          'display_name',
        );
        const relevantResults = searchArrayByText(
          friends,
          searchText,
          searchMapping,
        );
        setFriendsToDisplay(relevantResults); // Hide irrelevant
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.DATABASE.SEARCH_FAILED, error);
      } finally {
        setIsSearching(false);
      }
    },
    [friends, profileList],
  );

  const resetSearch = () => {
    setFriendsToDisplay(friends);
  };

  // On a cold boot `userData.friends` is briefly undefined until the `app/open`
  // bootstrap hydrates the friend list, and `objKeys(undefined)` collapses to
  // `[]`. Without this, the empty state would render before the list arrives.
  // `contentState` disambiguates an empty list: still loading (online) vs.
  // can't-load-yet (offline, nothing cached) vs. genuinely empty (bootstrap
  // done). This mirrors HomeScreen's `getHomeContentState`. `isLoadingApp` is
  // the same bootstrap-complete signal the onboarding/terms guards gate on.
  const contentState = getFriendListContentState(
    friends.length,
    isLoadingApp,
    isOffline,
  );

  const emptyListComponent = useMemo(() => {
    if (contentState === 'offlineUnavailable') {
      return (
        <View style={[styles.fullScreenCenteredContent, styles.ph5]}>
          <Text style={[styles.textHeadlineH1, styles.textAlignCenter]}>
            {translate('friendListScreen.offlineNoData.title')}
          </Text>
          <Text
            style={[
              styles.textNormal,
              styles.textSupporting,
              styles.textAlignCenter,
              styles.mt2,
            ]}>
            {translate('friendListScreen.offlineNoData.message')}
          </Text>
        </View>
      );
    }
    if (!userHasFriends) {
      return <NoFriendInfo />;
    }
    return (
      <Text style={styles.noResultsText}>
        {`${translate('userList.noFriendsFound')}\n\n${translate('userList.tryModifyingSearch')}`}
      </Text>
    );
  }, [
    contentState,
    userHasFriends,
    styles.fullScreenCenteredContent,
    styles.ph5,
    styles.textHeadlineH1,
    styles.textAlignCenter,
    styles.textNormal,
    styles.textSupporting,
    styles.mt2,
    styles.noResultsText,
    translate,
  ]);

  useEffect(() => {
    const friendsArray = objKeys(userData?.friends);
    setFriends(friendsArray);
    setFriendsToDisplay(friendsArray);
    setUserHasFriends(friendsArray.length > 0);
  }, [userData]);

  return (
    <View style={styles.flex1}>
      <SearchWindow
        windowText={translate('friendListScreen.searchYourFriendList')}
        onSearch={localSearch}
        onResetSearch={resetSearch}
        searchOnTextChange
      />
      <UserListComponent
        fullUserArray={friends}
        initialLoadSize={20}
        profileList={profileList}
        userStatusList={userStatusList}
        emptyListComponent={emptyListComponent}
        userSubset={friendsToDisplay}
        orderUsers
        isLoading={
          isLoadingFriends || isSearching || contentState === 'loading'
        }
      />
    </View>
  );
}
export default FriendListScreen;
