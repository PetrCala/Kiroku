import type {ListRenderItemInfo} from 'react-native';
import React, {useCallback, useMemo, useState} from 'react';
import type {
  FriendRequestList,
  FriendRequestStatus,
  ProfileList,
} from '@src/types/onyx';
import Text from '@components/Text';
import type {UserList} from '@src/types/onyx/OnyxCommon';
import {useFirebase} from '@src/context/global/FirebaseContext';
import {isEmptyArray} from '@src/types/utils/EmptyObject';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as Profile from '@userActions/Profile';
import {searchDatabaseForUsers} from '@userActions/User';
import SearchResult from '@components/Search/SearchResult';
import SearchWindow from '@components/Social/SearchWindow';
import type {UserSearchResults} from '@src/types/various/Search';
import useCurrentUserData from '@hooks/useCurrentUserData';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import useThemeStyles from '@hooks/useThemeStyles';
import FlatList from '@components/FlatList';
import ERRORS from '@src/ERRORS';

function FriendSearchScreen() {
  const {auth, storage} = useFirebase();
  const styles = useThemeStyles();
  const userData = useCurrentUserData();
  const user = auth.currentUser;
  const {translate} = useLocalize();
  const [searchResultData, setSearchResultData] = useState<UserSearchResults>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<UserList | undefined>(undefined);
  const [friendRequests, setFriendRequests] = useState<
    FriendRequestList | undefined
  >(undefined);
  const [requestStatuses, setRequestStatuses] = useState<
    Record<string, FriendRequestStatus | undefined>
  >({});
  const [noUsersFound, setNoUsersFound] = useState(false);
  const [displayData, setDisplayData] = useState<ProfileList>({});

  /** Having a list of users returned by the search,
   * determine the request status for each and update
   * the RequestStatuses hook.
   */
  const updateRequestStatuses = useCallback(
    (data: UserSearchResults = searchResultData): void => {
      if (!friendRequests) {
        setRequestStatuses({});
        return;
      }

      const newRequestStatuses: Record<string, FriendRequestStatus> = {};
      data.forEach(userID => {
        if (!friendRequests[userID]) {
          return;
        }
        newRequestStatuses[userID] = friendRequests[userID];
      });

      setRequestStatuses(newRequestStatuses);
    },
    [friendRequests, searchResultData],
  );

  const resetSearch = useCallback((): void => {
    // Reset all values displayed on screen
    setSearching(false);
    setSearchResultData([]);
    setRequestStatuses({});
    setDisplayData({});
    setNoUsersFound(false);
  }, []);

  const dbSearch = useCallback(
    async (searchText: string): Promise<void> => {
      // An empty/whitespace query (e.g. on mount or after clearing) should
      // clear the screen rather than render the "no users found" message.
      if (!searchText.trim()) {
        resetSearch();
        return;
      }
      try {
        setSearching(true);
        const newData: UserSearchResults =
          await searchDatabaseForUsers(searchText);
        const newDisplayData: ProfileList =
          await Profile.fetchUserProfiles(newData);
        updateRequestStatuses(newData);
        setDisplayData(newDisplayData);
        setNoUsersFound(isEmptyArray(newData));
        setSearchResultData(newData);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.DATABASE.SEARCH_FAILED, error);
      } finally {
        setSearching(false);
      }
    },
    [updateRequestStatuses, resetSearch],
  );

  useMemo(() => {
    if (!userData) {
      return;
    }
    setFriends(userData.friends);
    setFriendRequests(userData.friend_requests);
  }, [userData]);

  useMemo(() => {
    updateRequestStatuses();
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, [friendRequests]); // When updated in the database, not locally

  const renderItem = useCallback(
    ({item: userID}: ListRenderItemInfo<string>) => (
      <SearchResult
        userID={userID}
        userDisplayData={displayData[userID]}
        storage={storage}
        userFrom={user?.uid ?? ''}
        requestStatus={requestStatuses[userID]}
        alreadyAFriend={friends ? friends[userID] : false}
      />
    ),
    [displayData, storage, user?.uid, requestStatuses, friends],
  );

  if (!user) {
    return;
  }

  return (
    <ScreenWrapper testID={FriendSearchScreen.displayName}>
      <HeaderWithBackButton
        title={translate('friendSearchScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <SearchWindow
        // ref={searchInputRef}
        windowText={translate('friendSearchScreen.searchWindow')}
        onSearch={dbSearch}
        onResetSearch={resetSearch}
        searchOnTextChange
      />
      {searching ? (
        <FlexibleLoadingIndicator style={styles.pt4} />
      ) : (
        <FlatList
          style={[styles.w100, styles.flex1]}
          contentContainerStyle={[styles.pt1]}
          keyboardShouldPersistTaps="always"
          data={searchResultData}
          renderItem={renderItem}
          keyExtractor={userID => `${userID}-container`}
          ListEmptyComponent={
            noUsersFound ? (
              <Text style={styles.noResultsText}>
                {translate('friendSearchScreen.noUsersFound')}
              </Text>
            ) : undefined
          }
        />
      )}
    </ScreenWrapper>
  );
}

FriendSearchScreen.displayName = 'Friend Search Screen';
export default FriendSearchScreen;
