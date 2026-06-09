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
import NoFriendInfo from '@components/Social/NoFriendInfo';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import ERRORS from '@src/ERRORS';

function FriendListScreen() {
  const userData = useCurrentUserData();
  const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
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

  const emptyListComponent = useMemo(() => {
    if (!userHasFriends) {
      return <NoFriendInfo />;
    }
    return (
      <Text style={styles.noResultsText}>
        {`${translate('userList.noFriendsFound')}\n\n${translate('userList.tryModifyingSearch')}`}
      </Text>
    );
  }, [userHasFriends, styles.noResultsText, translate]);

  useEffect(() => {
    const friendsArray = objKeys(userData?.friends);
    setFriends(friendsArray);
    setFriendsToDisplay(friendsArray);
    setUserHasFriends(friendsArray.length > 0);
  }, [userData]);

  // On a cold boot `userData.friends` is briefly undefined until the `app/open`
  // bootstrap hydrates the friend list. Without this gate, `objKeys(undefined)`
  // collapses to `[]` and the "no friends" empty state flashes before the list
  // arrives (it then self-corrects, and a reload paints instantly from the
  // persisted Onyx cache, so the flash is first-launch-only). Keep the list in
  // its loading state until the bootstrap completes (`isLoadingApp === false`,
  // the same bootstrap-complete signal the onboarding/terms guards gate on) or
  // we already have friends to show.
  const isInitialFriendsLoad = isLoadingApp !== false && friends.length === 0;

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
