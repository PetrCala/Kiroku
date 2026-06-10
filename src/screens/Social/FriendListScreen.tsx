import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import SearchWindow from '@components/Social/SearchWindow';
import type {UserIDToNicknameMapping} from '@src/types/various/Search';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {objKeys} from '@libs/DataHandling';
import {getNicknameMapping, searchArrayByText} from '@libs/Search';
import {filterBlockedUsers} from '@libs/BlockUtils';
import useCurrentUserData from '@hooks/useCurrentUserData';
import type {UserArray} from '@src/types/onyx/OnyxCommon';
import Text from '@components/Text';
import * as ErrorUtils from '@libs/ErrorUtils';
import UserListComponent from '@components/Social/UserListComponent';
import useFriendsData from '@hooks/useFriendsData';
import NoFriendInfo from '@components/Social/NoFriendInfo';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useNetwork from '@hooks/useNetwork';
import ONYXKEYS from '@src/ONYXKEYS';
import ERRORS from '@src/ERRORS';

function FriendListScreen() {
  const userData = useCurrentUserData();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const {isOffline} = useNetwork();
  const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
  const [friends, setFriends] = useState<UserArray>([]);
  const [friendsToDisplay, setFriendsToDisplay] = useState<UserArray>([]);
  const [userHasFriends, setUserHasFriends] = useState<boolean>(false);
  const {
    profileList,
    userStatusList,
    isLoading: isLoadingFriends,
  } = useFriendsData(friends);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // `friends` is empty until app/open delivers the friend list (or a warm cache
  // hydrates). `IS_LOADING_APP === false` marks that bootstrap as settled, but it
  // only flips in app/open's finallyData, which is deferred while offline, so it
  // stays `true` offline. Online with nothing yet: keep the list loading so the
  // first-boot "no friends" flash never shows. Offline with nothing cached:
  // bootstrap can't settle, so show an offline notice rather than spinning
  // forever or falsely claiming the user has no friends.
  const isBootstrapPending = isLoadingApp !== false && friends.length === 0;
  const isInitialFriendsLoad = isBootstrapPending && !isOffline;
  const isFriendsUnavailableOffline = isBootstrapPending && isOffline;

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

  const emptyListComponent = useMemo(() => {
    if (isFriendsUnavailableOffline) {
      return (
        <Text style={styles.noResultsText}>
          {translate('friendListScreen.offlineNoData')}
        </Text>
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
    isFriendsUnavailableOffline,
    userHasFriends,
    styles.noResultsText,
    translate,
  ]);

  useEffect(() => {
    // Consumption filter (#760): a block severs the friendship server-side, so
    // a blocked user normally won't be in `friends` at all. Filter on the
    // signed-in user's own block list anyway to cover any cached/edge case.
    const friendsArray = filterBlockedUsers(
      objKeys(userData?.friends),
      userData?.blocked,
    );
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
        isLoading={isLoadingFriends || isSearching || isInitialFriendsLoad}
      />
    </View>
  );
}
export default FriendListScreen;
