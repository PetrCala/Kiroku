import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  FriendRequestStatus,
  ProfileList,
  FriendRequestList,
} from '@src/types/onyx';
import type {UserList} from '@src/types/onyx/OnyxCommon';
import {useEffect, useMemo, useReducer} from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import {isNonEmptyArray} from '@libs/Validation';
import {searchArrayByText} from '@libs/Search';
import {fetchUserProfiles} from '@database/profile';
import SearchResult from '@components/Social/SearchResult';
import SearchWindow from '@components/Social/SearchWindow';
import GrayHeader from '@components/Header/GrayHeader';
import {getCommonFriends, getCommonFriendsCount} from '@libs/FriendUtils';
import type {
  UserIDToNicknameMapping,
  UserSearchResults,
} from '@src/types/various/Search';
import {objKeys} from '@libs/DataHandling';
import SeeProfileButton from '@components/Buttons/SeeProfileButton';
import type GeneralAction from '@src/types/various/GeneralAction';
import commonStyles from '@src/styles/commonStyles';
import {getNicknameMapping} from '@libs/SearchUtils';
import FillerView from '@components/FillerView';
import type {StackScreenProps} from '@react-navigation/stack';
import type {ProfileNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import DBPATHS from '@database/DBPATHS';
import {readDataOnce} from '@database/baseFunctions';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import CONST from '@src/CONST';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';

type State = {
  searching: boolean;
  friends: UserList | undefined;
  displayedFriends: UserSearchResults;
  commonFriends: UserSearchResults;
  otherFriends: UserSearchResults;
  requestStatuses: Record<string, FriendRequestStatus | undefined>;
  noUsersFound: boolean;
  displayData: ProfileList;
  isLoading: boolean;
};

const initialState: State = {
  searching: false,
  friends: undefined,
  displayedFriends: [],
  commonFriends: [],
  otherFriends: [],
  requestStatuses: {},
  noUsersFound: false,
  displayData: {},
  isLoading: true,
};

const reducer = (state: State, action: GeneralAction): State => {
  switch (action.type) {
    case 'SET_SEARCHING':
      return {...state, searching: action.payload};
    case 'SET_FRIENDS':
      return {...state, friends: action.payload};
    case 'SET_DISPLAYED_FRIENDS':
      return {...state, displayedFriends: action.payload};
    case 'SET_COMMON_FRIENDS':
      return {...state, commonFriends: action.payload};
    case 'SET_OTHER_FRIENDS':
      return {...state, otherFriends: action.payload};
    case 'SET_REQUEST_STATUSES':
      return {...state, requestStatuses: action.payload};
    case 'SET_NO_USERS_FOUND':
      return {...state, noUsersFound: action.payload};
    case 'SET_DISPLAY_DATA':
      return {...state, displayData: action.payload};
    case 'SET_IS_LOADING':
      return {...state, isLoading: action.payload};
    default:
      return state;
  }
};

type FriendsFriendsScreenProps = StackScreenProps<
  ProfileNavigatorParamList,
  typeof SCREENS.PROFILE.FRIENDS_FRIENDS
>;

function FriendsFriendsScreen({route}: FriendsFriendsScreenProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const {userID} = route.params;
  const {auth, db, storage} = useFirebase();
  const {userData} = useDatabaseData();
  const user = auth.currentUser;
  const {translate} = useLocalize();
  const [state, dispatch] = useReducer(reducer, initialState);

  const localSearch = async (searchText: string): Promise<void> => {
    try {
      const searchMapping: UserIDToNicknameMapping = getNicknameMapping(
        state.displayData,
        'display_name',
      );
      const relevantResults = searchArrayByText(
        objKeys(state.friends),
        searchText,
        searchMapping,
      );
      dispatch({type: 'SET_DISPLAYED_FRIENDS', payload: relevantResults}); // Hide irrelevant
    } catch (error: any) {
      Alert.alert(
        'Database serach failed',
        'Could not search the database: ' + error.message,
      );
      return;
    }
  };

  const updateDisplayData = async (
    searchResultData: UserSearchResults,
  ): Promise<void> => {
    const newDisplayData: ProfileList = await fetchUserProfiles(
      db,
      searchResultData,
    );
    dispatch({type: 'SET_DISPLAY_DATA', payload: newDisplayData});
  };

  useMemo(() => {
    const updateRequestStatuses = (
      friendRequests: FriendRequestList | undefined,
    ): void => {
      const newRequestStatuses: Record<string, FriendRequestStatus> = {};
      if (friendRequests) {
        Object.keys(friendRequests).forEach(userID => {
          newRequestStatuses[userID] = friendRequests[userID];
        });
      }
      dispatch({type: 'SET_REQUEST_STATUSES', payload: newRequestStatuses});
    };
    updateRequestStatuses(userData?.friend_requests);
  }, [userData?.friend_requests, state.friends]);

  const updateHooksBasedOnSearchResults = async (
    searchResults: UserSearchResults,
  ): Promise<void> => {
    // updateRequestStatuses(searchResults); // Perhaps redundant
    await updateDisplayData(searchResults); // Assuming this returns a Promise
    const noUsersFound = !isNonEmptyArray(searchResults);
    dispatch({type: 'SET_NO_USERS_FOUND', payload: noUsersFound});
  };

  const renderSearchResults = (renderCommonFriends: boolean): JSX.Element[] => {
    return state.displayedFriends
      .filter(
        userID => state.commonFriends.includes(userID) === renderCommonFriends,
      )
      .map(userID => (
        <SearchResult
          key={userID + '-container'}
          userID={userID}
          userDisplayData={state.displayData[userID]}
          db={db}
          storage={storage}
          //@ts-ignore
          userFrom={user.uid}
          requestStatus={state.requestStatuses[userID]}
          alreadyAFriend={userData?.friends ? userData?.friends[userID] : false}
          customButton={
            renderCommonFriends ? (
              <SeeProfileButton
                key={userID + '-button'}
                onPress={() =>
                  Navigation.navigate(ROUTES.PROFILE.getRoute(userID))
                }
              />
            ) : null
          }
        />
      ));
  };

  const fetchData = async () => {
    try {
      dispatch({type: 'SET_IS_LOADING', payload: true});
      const userFriends: UserList | undefined = await readDataOnce(
        db,
        DBPATHS.USERS_USER_ID_FRIENDS.getRoute(userID),
      );
      dispatch({type: 'SET_FRIENDS', payload: userFriends});
    } finally {
      dispatch({type: 'SET_IS_LOADING', payload: false});
    }
  };

  // Database data hooks
  useEffect(() => {
    fetchData();
  }, [userID]);

  // Monitor friend groups
  useMemo(() => {
    let commonFriends: string[] = [];
    let otherFriends: string[] = [];
    if (state.friends) {
      commonFriends = getCommonFriends(
        objKeys(state.friends),
        objKeys(userData?.friends),
      );
      otherFriends = objKeys(state.friends).filter(
        friend => !commonFriends.includes(friend),
      );
    }
    dispatch({type: 'SET_COMMON_FRIENDS', payload: commonFriends});
    dispatch({type: 'SET_OTHER_FRIENDS', payload: otherFriends});
  }, [userData, state.friends, state.requestStatuses]);

  useMemo(() => {
    let noUsersFound = true;
    if (isNonEmptyArray(state.displayedFriends)) {
      noUsersFound = false;
    }
    dispatch({type: 'SET_NO_USERS_FOUND', payload: noUsersFound});
  }, [state.displayedFriends]);

  useEffect(() => {
    const initialSearch = async (): Promise<void> => {
      dispatch({type: 'SET_SEARCHING', payload: true});
      const friendIds = objKeys(state.friends);
      await updateHooksBasedOnSearchResults(friendIds);
      dispatch({type: 'SET_DISPLAYED_FRIENDS', payload: friendIds});
      dispatch({type: 'SET_SEARCHING', payload: false});
    };
    initialSearch();
  }, [state.friends]);

  const resetSearch = (): void => {
    // Reset all values displayed on screen
    const friendIds = objKeys(state.friends);
    dispatch({type: 'SET_DISPLAYED_FRIENDS', payload: friendIds});
    dispatch({type: 'SET_SEARCHING', payload: false});
    dispatch({type: 'SET_NO_USERS_FOUND', payload: false});
  };

  return (
    <ScreenWrapper testID={FriendsFriendsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('friendsFriendsScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <SearchWindow
        windowText="Search this user's friends"
        onSearch={localSearch}
        onResetSearch={resetSearch}
        searchOnTextChange={true}
      />
      <ScrollView
        style={localStyles.scrollViewContainer}
        onScrollBeginDrag={Keyboard.dismiss}
        keyboardShouldPersistTaps="handled">
        <View style={localStyles.searchResultsContainer}>
          {state.searching ? (
            <FlexibleLoadingIndicator />
          ) : isNonEmptyArray(state.displayedFriends) ? (
            <>
              <GrayHeader
                headerText={`Common Friends (${getCommonFriendsCount(
                  state.commonFriends,
                  state.displayedFriends,
                )})`}
              />
              {renderSearchResults(true)}
              <GrayHeader
                headerText={`Other Friends (${getCommonFriendsCount(
                  state.otherFriends,
                  state.displayedFriends,
                )})`}
              />
              {renderSearchResults(false)}
            </>
          ) : state.noUsersFound ? (
            <Text style={commonStyles.noUsersFoundText}>
              {objKeys(state.friends).length > 0
                ? 'No friends found.\n\nTry searching for other users.'
                : 'This user has not added any friends yet.'}
            </Text>
          ) : null}
        </View>
        <FillerView height={100} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const localStyles = StyleSheet.create({
  scrollViewContainer: {
    flex: 1,
    backgroundColor: '#ffff99',
  },
  textContainer: {
    width: '95%',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    backgroundColor: 'white',
    marginTop: 10,
    marginBottom: 5,
    alignSelf: 'center',
  },
  searchText: {
    height: '100%',
    width: '90%',
    padding: 10,
    marginTop: 5,
    marginBottom: 5,
  },
  searchTextResetContainer: {
    width: '10%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchTextResetImage: {
    width: 15,
    height: 15,
    tintColor: 'gray',
  },
  searchButtonContainer: {
    width: '95%',
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 5,
  },
  searchResultsContainer: {
    width: '100%',
    flexDirection: 'column',
  },
});

FriendsFriendsScreen.displayName = 'Friends Friends Screen';
export default FriendsFriendsScreen;
