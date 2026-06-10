import {View} from 'react-native';
import type {
  FriendRequestStatus,
  ProfileList,
  FriendRequestList,
} from '@src/types/onyx';
import {useCallback, useEffect, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import {isEmptyArray} from '@src/types/utils/EmptyObject';
import {searchArrayByText, getNicknameMapping} from '@libs/Search';
import * as Profile from '@userActions/Profile';
import SearchResult from '@components/Search/SearchResult';
import SearchWindow from '@components/Social/SearchWindow';
import GrayHeader from '@components/Header/GrayHeader';
import {getCommonFriends, getCommonFriendsCount} from '@libs/FriendUtils';
import {filterBlockedUsers} from '@libs/BlockUtils';
import type {
  UserIDToNicknameMapping,
  UserSearchResults,
} from '@src/types/various/Search';
import * as ErrorUtils from '@libs/ErrorUtils';
import {objKeys} from '@libs/DataHandling';
import FillerView from '@components/FillerView';
import type {StackScreenProps} from '@react-navigation/stack';
import type {ProfileNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useNetwork from '@hooks/useNetwork';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import ONYXKEYS from '@src/ONYXKEYS';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import Button from '@components/Button';
import Text from '@components/Text';
import ScrollView from '@components/ScrollView';
import ERRORS from '@src/ERRORS';

type FriendsFriendsScreenProps = StackScreenProps<
  ProfileNavigatorParamList,
  typeof SCREENS.PROFILE.FRIENDS_FRIENDS
>;

function FriendsFriendsScreen({route}: FriendsFriendsScreenProps) {
  const styles = useThemeStyles();
  const {userID} = route.params;
  const {auth} = useFirebase();
  const userData = useCurrentUserData();
  const user = auth.currentUser;
  const {translate} = useLocalize();
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  // The target user's friends, read via the kiroku-api into
  // `userDataList[userID].friends` (replacing the direct Firebase read).
  const friends = userDataList?.[userID]?.friends;
  // Consumption filter (#760): exclude anyone the signed-in user has blocked
  // from the viewed user's friend list, so a user I blocked never appears in
  // their "common"/"other" friends (counts or rows). `blocked` is my own
  // outbound block list; `friends` here is someone else's list, which the server
  // does not filter against my blocks. The effects below recompute this from the
  // stable `friends`/`blocked` Onyx refs to keep their dependency arrays
  // referentially stable; this render-scoped copy serves the synchronous render
  // paths (search handlers + the empty-state check).
  const blocked = userData?.blocked;
  const visibleFriendIds = filterBlockedUsers(objKeys(friends), blocked);
  const [searching, setSearching] = useState<boolean>(false);
  const [displayedFriends, setDisplayedFriends] = useState<UserSearchResults>(
    [],
  );
  const [commonFriends, setCommonFriends] = useState<UserSearchResults>([]);
  const [otherFriends, setOtherFriends] = useState<UserSearchResults>([]);
  const [requestStatuses, setRequestStatuses] = useState<
    Record<string, FriendRequestStatus | undefined>
  >({});
  const [noUsersFound, setNoUsersFound] = useState<boolean>(false);
  const [displayData, setDisplayData] = useState<ProfileList>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const onLocalSearch = (searchText: string) => {
    try {
      const searchMapping: UserIDToNicknameMapping = getNicknameMapping(
        displayData,
        'display_name',
      );
      const relevantResults = searchArrayByText(
        visibleFriendIds,
        searchText,
        searchMapping,
      );
      setDisplayedFriends(relevantResults); // Hide irrelevant
    } catch (error) {
      ErrorUtils.raiseAppError(ERRORS.ONYX.GENERIC, error);
    }
  };

  const renderSearchResults = (renderCommonFriends: boolean): JSX.Element[] => {
    const currentUserId = user?.uid;
    if (!currentUserId) {
      return [];
    }

    return displayedFriends
      .filter(id => commonFriends.includes(id) === renderCommonFriends)
      .map(id => (
        <SearchResult
          key={`${id}-container`}
          userID={id}
          userDisplayData={displayData[id]}
          userFrom={currentUserId}
          requestStatus={requestStatuses[id]}
          alreadyAFriend={userData?.friends ? userData?.friends[id] : false}
          customButton={
            renderCommonFriends && (
              <Button
                key={`${id}-button`}
                text={translate('friendsFriendsScreen.seeProfile')}
                onPress={() => Navigation.navigate(ROUTES.PROFILE.getRoute(id))}
                style={[styles.alignItemsCenter, styles.justifyContentCenter]}
              />
            )
          }
        />
      ));
  };

  const updateDisplayData = useCallback(
    async (searchResultData: UserSearchResults): Promise<void> => {
      const newDisplayData: ProfileList =
        await Profile.fetchUserProfiles(searchResultData);
      setDisplayData(newDisplayData);
    },
    [],
  );

  useEffect(() => {
    const updateRequestStatuses = (
      friendRequests: FriendRequestList | undefined,
    ): void => {
      const newRequestStatuses: Record<string, FriendRequestStatus> = {};
      if (friendRequests) {
        Object.keys(friendRequests).forEach(id => {
          newRequestStatuses[id] = friendRequests[id];
        });
      }
      setRequestStatuses(newRequestStatuses);
    };
    updateRequestStatuses(userData?.friend_requests);
  }, [userData?.friend_requests]);

  const updateHooksBasedOnSearchResults = useCallback(
    async (searchResults: UserSearchResults): Promise<void> => {
      await updateDisplayData(searchResults);
      const newNoUsersFound = isEmptyArray(searchResults);
      setNoUsersFound(newNoUsersFound);
    },
    [updateDisplayData],
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Read the target user's friends via the kiroku-api (merged into
      // `userDataList[userID].friends`), replacing the direct Firebase read.
      await Profile.openFriendList(userID);
    } finally {
      setIsLoading(false);
    }
  }, [userID]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-issue the friends read when connectivity resumes. `openFriendList` goes
  // through `makeRequestWithSideEffects`, which DISCARDS a read while offline
  // instead of queueing it (unlike `API.write`), and the mount effect above is
  // keyed on `fetchData`/`userID` so it never re-runs on reconnect — without
  // this an offline mount leaves the screen stuck on its empty state. Call the
  // read directly (not `fetchData`, which toggles `isLoading`): it carries no
  // optimistic data and refreshes `userDataList[userID].friends` in place, which
  // cascades through the `initialSearch` effect to repaint the list.
  useNetwork({
    onReconnect: () => {
      Profile.openFriendList(userID);
    },
  });

  useEffect(() => {
    const initialSearch = async (): Promise<void> => {
      setSearching(true);
      const friendIds = filterBlockedUsers(objKeys(friends), blocked);
      await updateHooksBasedOnSearchResults(friendIds);
      setDisplayedFriends(friendIds);
      setSearching(false);
    };
    initialSearch();
  }, [friends, blocked, updateHooksBasedOnSearchResults]);

  // Monitor friend groups
  useEffect(() => {
    let newCommonFriends: string[] = [];
    let newOtherFriends: string[] = [];
    if (friends) {
      const friendIds = filterBlockedUsers(objKeys(friends), blocked);
      newCommonFriends = getCommonFriends(
        friendIds,
        objKeys(userData?.friends),
        blocked,
      );
      newOtherFriends = friendIds.filter(
        friend => !newCommonFriends.includes(friend),
      );
    }
    setCommonFriends(newCommonFriends);
    setOtherFriends(newOtherFriends);
  }, [userData?.friends, friends, blocked]);

  useEffect(() => {
    let newNoUsersFound = true;
    if (!isEmptyArray(displayedFriends)) {
      newNoUsersFound = false;
    }
    setNoUsersFound(newNoUsersFound);
  }, [displayedFriends]);

  const resetSearch = (): void => {
    // Reset all values displayed on screen
    setDisplayedFriends(visibleFriendIds);
    setSearching(false);
    setNoUsersFound(false);
  };

  return (
    <ScreenWrapper testID={FriendsFriendsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('friendsFriendsScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <SearchWindow
        windowText={translate('friendsFriendsScreen.searchUsersFriends')}
        onSearch={onLocalSearch}
        onResetSearch={resetSearch}
        searchOnTextChange
      />
      <ScrollView style={styles.flex1}>
        <View style={[styles.mt2, styles.flexColumn]}>
          {searching || isLoading ? (
            <FlexibleLoadingIndicator />
          ) : (
            <View>
              {!isEmptyArray(displayedFriends) ? (
                <View style={styles.appBG}>
                  <GrayHeader
                    headerText={`${translate('friendsFriendsScreen.commonFriends')} (${getCommonFriendsCount(
                      commonFriends,
                      displayedFriends,
                    )})`}
                  />
                  {renderSearchResults(true)}
                  <GrayHeader
                    headerText={`${translate('friendsFriendsScreen.otherFriends')} (${getCommonFriendsCount(
                      otherFriends,
                      displayedFriends,
                    )})`}
                  />
                  {renderSearchResults(false)}
                </View>
              ) : (
                noUsersFound && (
                  <Text style={styles.noResultsText}>
                    {visibleFriendIds.length > 0
                      ? `${translate('friendsFriendsScreen.noFriendsFound')}\n\n${translate(
                          'friendsFriendsScreen.trySearching',
                        )}`
                      : translate('friendsFriendsScreen.hasNoFriends')}
                  </Text>
                )
              )}
            </View>
          )}
        </View>
        <FillerView />
      </ScrollView>
    </ScreenWrapper>
  );
}

FriendsFriendsScreen.displayName = 'Friends Friends Screen';
export default FriendsFriendsScreen;
