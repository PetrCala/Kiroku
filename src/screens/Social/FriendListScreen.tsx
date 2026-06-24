import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import SearchWindow from '@components/Social/SearchWindow';
import type {UserIDToNicknameMapping} from '@src/types/various/Search';
import React, {useCallback, useState} from 'react';
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
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import ONYXKEYS from '@src/ONYXKEYS';
import ERRORS from '@src/ERRORS';

function FriendListScreen() {
  const userData = useCurrentUserData();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const {isOffline} = useNetwork();
  const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);

  // Derive the friend set straight from the signed-in user's own record. Doing
  // this at render time (rather than copying it into state via a useEffect)
  // keeps the list, its empty/loading gates, and the record in lockstep: a
  // useEffect copy lags `userData` by a render, and that one-frame gap is part
  // of the window where a "No friends" flash slips through on a cold load.
  // Left unmemoized on purpose — the React Compiler handles it (CLEAN-REACT-0).
  const friends = filterBlockedUsers(
    objKeys(userData?.friends),
    userData?.blocked,
  );
  const userHasFriends = friends.length > 0;

  const {
    profileList,
    userStatusList,
    isLoading: isLoadingFriends,
  } = useFriendsData(friends);

  // `null` means no active search; otherwise the narrowed subset to display.
  const [searchResults, setSearchResults] = useState<UserArray | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const friendsToDisplay = searchResults ?? friends;

  // Stay in the cold-load state until BOTH the OpenApp bootstrap has settled
  // (`IS_LOADING_APP === false`, set in app/open's finallyData) AND the
  // signed-in user's own record has hydrated into `USER_DATA_LIST`. The
  // bootstrap flag alone is insufficient: it is a tiny merge that can commit a
  // beat before the large user record lands (the two commit independently
  // inside one Onyx batch), and in that gap an already-friended user would
  // momentarily read as having no friends. `IS_LOADING_APP` stays `true` while
  // offline (its finallyData is deferred), so once nothing is cached and we are
  // offline, surface an offline notice rather than spinning forever or falsely
  // claiming the user has no friends.
  const isUserRecordLoaded = !isEmptyObject(userData);
  const isBootstrapPending =
    (isLoadingApp !== false || !isUserRecordLoaded) && !userHasFriends;
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
        setSearchResults(relevantResults); // Hide irrelevant
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.DATABASE.SEARCH_FAILED, error);
      } finally {
        setIsSearching(false);
      }
    },
    [friends, profileList],
  );

  const resetSearch = () => {
    setSearchResults(null);
  };

  let emptyListComponent: React.JSX.Element;
  if (isFriendsUnavailableOffline) {
    emptyListComponent = (
      <Text style={styles.noResultsText}>
        {translate('friendListScreen.offlineNoData')}
      </Text>
    );
  } else if (!userHasFriends) {
    emptyListComponent = <NoFriendInfo />;
  } else {
    emptyListComponent = (
      <Text style={styles.noResultsText}>
        {`${translate('userList.noFriendsFound')}\n\n${translate('userList.tryModifyingSearch')}`}
      </Text>
    );
  }

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
