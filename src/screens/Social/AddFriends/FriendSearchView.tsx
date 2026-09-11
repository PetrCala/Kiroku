import type {ListRenderItemInfo} from 'react-native';
import {View} from 'react-native';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import type {FriendRequestStatus, ProfileList} from '@src/types/onyx';
import Button from '@components/Button';
import Text from '@components/Text';
import {useFirebase} from '@src/context/global/FirebaseContext';
import {isEmptyArray} from '@src/types/utils/EmptyObject';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as Profile from '@userActions/Profile';
import {searchDatabaseForUsers} from '@userActions/User';
import SearchResult from '@components/Search/SearchResult';
import SearchWindow from '@components/Social/SearchWindow';
import type {UserSearchResults} from '@src/types/various/Search';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import useThemeStyles from '@hooks/useThemeStyles';
import FlatList from '@components/FlatList';
import {filterBlockedUsers} from '@libs/BlockUtils';
import ERRORS from '@src/ERRORS';

type FriendSearchViewProps = {
  /** Switches the hub to the "Your code" tab */
  onShowInviteCode: () => void;
};

/**
 * The "Search" tab of the Add friends hub: nickname search with send/accept
 * actions per result, plus a footer pointing people who aren't on Kiroku yet
 * to the invite link.
 */
function FriendSearchView({onShowInviteCode}: FriendSearchViewProps) {
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
  const [noUsersFound, setNoUsersFound] = useState(false);
  const [displayData, setDisplayData] = useState<ProfileList>({});
  // The last query the search box emitted. `SearchWindow` owns the text (it only
  // re-calls `onSearch` when the debounced text changes), so we track it here to
  // be able to replay it when connectivity resumes.
  const lastSearchTextRef = useRef('');

  const friends = userData?.friends;
  const friendRequests = userData?.friend_requests;

  // The request status of every result, derived from the live friend requests
  // so it updates when a request changes on the server.
  const requestStatuses = useMemo(() => {
    const statuses: Record<string, FriendRequestStatus | undefined> = {};
    if (!friendRequests) {
      return statuses;
    }
    searchResultData.forEach(userID => {
      if (friendRequests[userID]) {
        statuses[userID] = friendRequests[userID];
      }
    });
    return statuses;
  }, [friendRequests, searchResultData]);

  const resetSearch = useCallback((): void => {
    setSearching(false);
    setSearchResultData([]);
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
        setDisplayData(newDisplayData);
        setNoUsersFound(isEmptyArray(newData));
        setSearchResultData(newData);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.DATABASE.SEARCH_FAILED, error);
      } finally {
        setSearching(false);
      }
    },
    [isOffline, resetSearch],
  );

  // Replay the pending query when connectivity resumes. The offline branch of
  // `dbSearch` short-circuits (search is a live, unqueueable read) and renders
  // the offline notice, but nothing re-runs the query once back online: the
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
    return null;
  }

  const renderSearchResults = () => {
    // User search needs a live server read, so offline we show a notice rather
    // than a perpetual spinner or an error.
    if (isOffline) {
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
    // Discovery filter (#759): never surface a user the signed-in user has
    // blocked. The server already excludes blocked users from search, so this is
    // defense-in-depth for any cached/edge-case result. When a search returns
    // only blocked users the list is empty, so fall through to "no users found".
    const visibleSearchResults = filterBlockedUsers(
      searchResultData,
      userData?.blocked,
    );
    return (
      <FlatList
        style={[styles.w100, styles.flex1]}
        contentContainerStyle={[styles.pt1]}
        keyboardShouldPersistTaps="always"
        data={visibleSearchResults}
        renderItem={renderItem}
        keyExtractor={userID => `${userID}-container`}
        ListEmptyComponent={
          noUsersFound || !isEmptyArray(searchResultData) ? (
            <Text style={styles.noResultsText}>
              {translate('friendSearchScreen.noUsersFound')}
            </Text>
          ) : undefined
        }
      />
    );
  };

  return (
    <View style={styles.flex1}>
      <SearchWindow
        windowText={translate('friendSearchScreen.searchWindow')}
        onSearch={dbSearch}
        onResetSearch={resetSearch}
        searchOnTextChange
      />
      {renderSearchResults()}
      <View
        style={[
          styles.flexRow,
          styles.flexWrap,
          styles.justifyContentCenter,
          styles.alignItemsCenter,
          styles.ph5,
          styles.pv4,
        ]}>
        <Text style={styles.textLabelSupporting}>
          {translate('addFriendsScreen.friendNotOnKiroku')}
        </Text>
        <Button
          text={translate('addFriendsScreen.inviteThemHere')}
          onPress={onShowInviteCode}
          style={[styles.bgTransparent, styles.p0, styles.ml1]}
          textStyles={styles.link}
        />
      </View>
    </View>
  );
}

FriendSearchView.displayName = 'FriendSearchView';
export default FriendSearchView;
