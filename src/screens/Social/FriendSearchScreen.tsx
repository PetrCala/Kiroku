import type {ListRenderItemInfo} from 'react-native';
import {View} from 'react-native';
import React, {useCallback, useMemo, useRef, useState} from 'react';
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
import useNetwork from '@hooks/useNetwork';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import useThemeStyles from '@hooks/useThemeStyles';
import FlatList from '@components/FlatList';
import ERRORS from '@src/ERRORS';

function FriendSearchScreen() {
  const {auth} = useFirebase();
  const styles = useThemeStyles();
  const userData = useCurrentUserData();
  const user = auth.currentUser;
  const {translate} = useLocalize();
  const {isOffline} = useNetwork();
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
  // The last query the search box emitted. `SearchWindow` owns the text (it only
  // re-calls `onSearch` when the debounced text changes), so we track it here to
  // be able to replay it when connectivity resumes.
  const lastSearchTextRef = useRef('');

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
      lastSearchTextRef.current = searchText;
      // User search is a live server read that can't be queued; offline it would
      // hang on a spinner or fail. Short-circuit and let the render show the
      // offline notice instead.
      if (isOffline) {
        resetSearch();
        return;
      }
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
    [isOffline, updateRequestStatuses, resetSearch],
  );

  // Replay the pending query when connectivity resumes. The offline branch of
  // `dbSearch` short-circuits (search is a live, unqueueable read) and renders
  // the offline notice, but nothing re-runs the query once back online — the
  // notice clears and the result list is left blank with the typed query still
  // in the box. Re-issue the last query the search box emitted on the
  // offline->online edge so reconnecting recovers the results in place. (Kept as
  // its own `useNetwork` call because the one above must read `isOffline` before
  // `dbSearch` is defined, and this handler must call `dbSearch`.)
  useNetwork({
    onReconnect: () => {
      if (!lastSearchTextRef.current.trim()) {
        return;
      }
      dbSearch(lastSearchTextRef.current);
    },
  });

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
        userFrom={user?.uid ?? ''}
        requestStatus={requestStatuses[userID]}
        alreadyAFriend={friends ? friends[userID] : false}
      />
    ),
    [displayData, user?.uid, requestStatuses, friends],
  );

  if (!user) {
    return;
  }

  const renderSearchResults = () => {
    // User search needs a live server read, so offline we show a notice rather
    // than a perpetual spinner or an error.
    if (isOffline) {
      // Fill the available space so the ScreenWrapper's trailing offline
      // indicator stays docked at the bottom instead of sitting right below
      // this notice.
      return (
        <View style={styles.flex1}>
          <Text style={[styles.noResultsText, styles.pt4]}>
            {translate('common.thisFeatureRequiresInternet')}
          </Text>
        </View>
      );
    }
    if (searching) {
      return <FlexibleLoadingIndicator style={styles.pt4} />;
    }
    return (
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
    );
  };

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
      {renderSearchResults()}
    </ScreenWrapper>
  );
}

FriendSearchScreen.displayName = 'Friend Search Screen';
export default FriendSearchScreen;
