import {View} from 'react-native';
import type {
  FriendRequestStatus,
  ProfileList,
  FriendRequestList,
} from '@src/types/onyx';
import type {UserList} from '@src/types/onyx/OnyxCommon';
import {useCallback, useEffect, useState} from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import {isEmptyArray} from '@src/types/utils/EmptyObject';
import {searchArrayByText, getNicknameMapping} from '@libs/Search';
import * as Profile from '@userActions/Profile';
import SearchResult from '@components/Search/SearchResult';
import SearchWindow from '@components/Social/SearchWindow';
import GrayHeader from '@components/Header/GrayHeader';
import {getCommonFriends, getCommonFriendsCount} from '@libs/FriendUtils';
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
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import DBPATHS from '@src/DBPATHS';
import {readDataOnce} from '@database/baseFunctions';
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
  const {auth, db, storage} = useFirebase();
  const {userData} = useDatabaseData();
  const user = auth.currentUser;
  const {translate} = useLocalize();
  const [searching, setSearching] = useState<boolean>(false);
  const [friends, setFriends] = useState<UserList | null | undefined>(
    undefined,
  );
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
        objKeys(friends),
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
          db={db}
          storage={storage}
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
      const newDisplayData: ProfileList = await Profile.fetchUserProfiles(
        db,
        searchResultData,
      );
      setDisplayData(newDisplayData);
    },
    [db],
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
      const userFriends = await readDataOnce<UserList>(
        db,
        DBPATHS.USERS_USER_ID_FRIENDS.getRoute(userID),
      );
      setFriends(userFriends);
    } finally {
      setIsLoading(false);
    }
  }, [db, userID]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const initialSearch = async (): Promise<void> => {
      setSearching(true);
      const friendIds = objKeys(friends);
      await updateHooksBasedOnSearchResults(friendIds);
      setDisplayedFriends(friendIds);
      setSearching(false);
    };
    initialSearch();
  }, [friends, updateHooksBasedOnSearchResults]);

  // Monitor friend groups
  useEffect(() => {
    let newCommonFriends: string[] = [];
    let newOtherFriends: string[] = [];
    if (friends) {
      newCommonFriends = getCommonFriends(
        objKeys(friends),
        objKeys(userData?.friends),
      );
      newOtherFriends = objKeys(friends).filter(
        friend => !newCommonFriends.includes(friend),
      );
    }
    setCommonFriends(newCommonFriends);
    setOtherFriends(newOtherFriends);
  }, [userData?.friends, friends]);

  useEffect(() => {
    let newNoUsersFound = true;
    if (!isEmptyArray(displayedFriends)) {
      newNoUsersFound = false;
    }
    setNoUsersFound(newNoUsersFound);
  }, [displayedFriends]);

  const resetSearch = (): void => {
    // Reset all values displayed on screen
    const friendIds = objKeys(friends);
    setDisplayedFriends(friendIds);
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
                    {objKeys(friends).length > 0
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
