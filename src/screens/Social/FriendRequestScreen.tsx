import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  FriendRequestList,
  FriendRequestStatus,
  ProfileList,
} from '@src/types/onyx';
import type {UserList} from '@src/types/onyx/OnyxCommon';
import {useEffect, useMemo, useReducer, useState} from 'react';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {useFirebase} from '@context/global/FirebaseContext';
import {acceptFriendRequest, deleteFriendRequest} from '@database/friends';
import type {Database} from 'firebase/database';
import NoFriendUserOverview from '@components/Social/NoFriendUserOverview';
import {fetchUserProfiles} from '@database/profile';
import headerStyles from '@src/styles/headerStyles';
import GrayHeader from '@components/Header/GrayHeader';
import {objKeys} from '@libs/DataHandling';
import CONST from '@src/CONST';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import NoFriendInfo from '@components/Social/NoFriendInfo';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import FillerView from '@components/FillerView';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';

type RequestIdProps = {
  requestId: string;
};

type FriendRequestComponentProps = {
  requestStatus: FriendRequestStatus | undefined;
  requestId: string;
};

type FriendRequestItemProps = {
  requestId: string;
  friendRequests: FriendRequestList | undefined;
  displayData: ProfileList;
};

type ScreenProps = {
  friendRequests: FriendRequestList | undefined;
  friends: UserList | undefined;
};

const handleAcceptFriendRequest = async (
  db: Database,
  userID: string,
  requestId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): Promise<void> => {
  try {
    setIsLoading(true);
    await acceptFriendRequest(db, userID, requestId);
    setIsLoading(false);
  } catch (error: any) {
    Alert.alert(
      'User does not exist in the database',
      'Could not accept the friend request: ' + error.message,
    );
  }
};

const handleRejectFriendRequest = async (
  db: Database,
  userID: string,
  requestId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): Promise<void> => {
  try {
    setIsLoading(true);
    await deleteFriendRequest(db, userID, requestId);
    setIsLoading(false);
  } catch (error: any) {
    Alert.alert(
      'User does not exist in the database',
      'Could not accept the friend request: ' + error.message,
    );
  }
};

// Component to be shown for a received friend request
const FriendRequestButtons: React.FC<RequestIdProps> = ({requestId}) => {
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  if (!user) {
    return;
  }

  return (
    <View style={styles.friendRequestButtonsContainer}>
      <TouchableOpacity
        accessibilityRole="button"
        key={requestId + '-accept-request-button'}
        style={[styles.handleRequestButton, styles.acceptRequestButton]}
        onPress={() =>
          handleAcceptFriendRequest(db, user.uid, requestId, setIsLoading)
        }>
        {isLoading ? (
          <ActivityIndicator size="small" color="#0000ff" />
        ) : (
          <Text style={styles.handleRequestButtonText}>Accept</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        key={requestId + '-reject-request-button'}
        style={[styles.handleRequestButton, styles.rejectRequestButton]}
        onPress={() =>
          handleRejectFriendRequest(db, user.uid, requestId, setIsLoading)
        }>
        <Text style={styles.handleRequestButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
};

// Component to be shown when the friend request is pending
const FriendRequestPending: React.FC<RequestIdProps> = ({requestId}) => {
  const {auth, db} = useFirebase();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const user = auth.currentUser;

  if (!user) {
    return;
  }

  return (
    <View style={styles.friendRequestPendingContainer}>
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.handleRequestButton, styles.rejectRequestButton]}
        onPress={() =>
          handleRejectFriendRequest(db, user.uid, requestId, setIsLoading)
        }>
        {isLoading ? (
          <FlexibleLoadingIndicator
            size={CONST.ACTIVITY_INDICATOR_SIZE.SMALL}
          />
        ) : (
          <Text style={styles.handleRequestButtonText}>Cancel</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// Component to be rendered on the right hand side of each friend request container
const FriendRequestComponent: React.FC<FriendRequestComponentProps> = ({
  requestStatus,
  requestId,
}) => {
  return requestStatus === CONST.FRIEND_REQUEST_STATUS.RECEIVED ? (
    <FriendRequestButtons
      key={requestId + '-friend-request-buttons'}
      requestId={requestId}
    />
  ) : requestStatus === CONST.FRIEND_REQUEST_STATUS.SENT ? (
    <FriendRequestPending
      key={requestId + '-friend-request-pending'}
      requestId={requestId}
    />
  ) : null;
};

const FriendRequestItem: React.FC<FriendRequestItemProps> = ({
  requestId,
  friendRequests,
  displayData,
}) => {
  if (!friendRequests || !displayData) {
    return null;
  }
  const profileData = displayData[requestId];
  const requestStatus = friendRequests[requestId];

  return (
    <NoFriendUserOverview
      key={requestId + '-friend-request'}
      userID={requestId}
      profileData={profileData}
      RightSideComponent={FriendRequestComponent({
        requestId,
        requestStatus,
      })}
    />
  );
};

type State = {
  isLoading: boolean;
  friendRequests: FriendRequestList | undefined;
  displayData: ProfileList;
  requestsSent: string[];
  requestsReceived: string[];
  requestsSentCount: number;
  requestsReceivedCount: number;
};

type Action = {
  type: string;
  payload: any;
};

const initialState: State = {
  isLoading: true,
  friendRequests: undefined,
  displayData: {},
  requestsSent: [],
  requestsReceived: [],
  requestsSentCount: 0,
  requestsReceivedCount: 0,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_IS_LOADING':
      return {...state, isLoading: action.payload};
    case 'SET_FRIEND_REQUESTS':
      return {...state, friendRequests: action.payload};
    case 'SET_DISPLAY_DATA':
      return {...state, displayData: action.payload};
    case 'SET_REQUESTS_SENT':
      return {...state, requestsSent: action.payload};
    case 'SET_REQUESTS_RECEIVED':
      return {...state, requestsReceived: action.payload};
    case 'SET_REQUESTS_SENT_COUNT':
      return {...state, requestsSentCount: action.payload};
    case 'SET_REQUESTS_RECEIVED_COUNT':
      return {...state, requestsReceivedCount: action.payload};
    default:
      return state;
  }
};

function FriendRequestScreen() {
  const {db} = useFirebase();
  const {userData, isLoading} = useDatabaseData();
  const [state, dispatch] = useReducer(reducer, initialState);

  useMemo(() => {
    if (userData) {
      dispatch({
        type: 'SET_FRIEND_REQUESTS',
        payload: userData?.friend_requests,
      });
    }
  }, [userData]);

  const updateDisplayData = async (
    db: Database,
    friendRequests: FriendRequestList | undefined,
  ): Promise<void> => {
    const newDisplayData: ProfileList = await fetchUserProfiles(
      db,
      objKeys(friendRequests),
    );
    dispatch({type: 'SET_DISPLAY_DATA', payload: newDisplayData});
  };

  useEffect(() => {
    const updateLocalHooks = async () => {
      dispatch({type: 'SET_IS_LOADING', payload: true});
      await updateDisplayData(db, state.friendRequests);
      dispatch({type: 'SET_IS_LOADING', payload: false});
    };
    updateLocalHooks();
  }, [state.friendRequests]);

  useMemo(() => {
    const newRequestsSent: string[] = [];
    const newRequestsReceived: string[] = [];
    if (!isEmptyObject(state.friendRequests)) {
      Object.keys(state.friendRequests).forEach(requestId => {
        if (!state.friendRequests) {
          return;
        }
        if (
          state.friendRequests[requestId] === CONST.FRIEND_REQUEST_STATUS.SENT
        ) {
          newRequestsSent.push(requestId);
        } else if (
          state.friendRequests[requestId] ===
          CONST.FRIEND_REQUEST_STATUS.RECEIVED
        ) {
          newRequestsReceived.push(requestId);
        }
      });
    }
    const newRequestsSentCount = newRequestsSent.length;
    const newRequestsReceivedCount = newRequestsReceived.length;

    dispatch({type: 'SET_REQUESTS_SENT', payload: newRequestsSent});
    dispatch({type: 'SET_REQUESTS_RECEIVED', payload: newRequestsReceived});
    dispatch({type: 'SET_REQUESTS_SENT_COUNT', payload: newRequestsSentCount});
    dispatch({
      type: 'SET_REQUESTS_RECEIVED_COUNT',
      payload: newRequestsReceivedCount,
    });
  }, [state.friendRequests]);

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        style={styles.scrollViewContainer}
        onScrollBeginDrag={Keyboard.dismiss}
        keyboardShouldPersistTaps="handled">
        {state.isLoading || isLoading ? (
          <FlexibleLoadingIndicator style={styles.loadingData} />
        ) : !isEmptyObject(state.friendRequests) ? (
          <View style={styles.friendList}>
            <GrayHeader
              headerText={`Requests Received (${state.requestsReceivedCount})`}
            />
            <View style={styles.requestsContainer}>
              {state.requestsReceived.map(requestId => (
                <FriendRequestItem
                  key={requestId + '-friend-request-item'}
                  requestId={requestId}
                  friendRequests={state.friendRequests}
                  displayData={state.displayData}
                />
              ))}
            </View>
            <View style={headerStyles.grayHeaderContainer}>
              <Text style={headerStyles.grayHeaderText}>
                Requests Sent ({state.requestsSentCount})
              </Text>
            </View>
            <View style={styles.requestsContainer}>
              {state.requestsSent.map(requestId => (
                <FriendRequestItem
                  key={requestId + '-friend-request-item'}
                  requestId={requestId}
                  friendRequests={state.friendRequests}
                  displayData={state.displayData}
                />
              ))}
            </View>
            <FillerView height={100} />
          </View>
        ) : (
          <NoFriendInfo
            message="Looking for new friends?"
            buttonText="Try searching here"
          />
        )}
      </ScrollView>
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.searchScreenButton}
        onPress={() => Navigation.navigate(ROUTES.SOCIAL_FRIEND_SEARCH)}>
        <Image source={KirokuIcons.Search} style={styles.searchScreenImage} />
      </TouchableOpacity>
    </View>
  );
}

export default FriendRequestScreen;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffff99',
  },
  scrollViewContainer: {
    flex: 1,
    backgroundColor: '#ffff99',
  },
  loadingData: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    margin: 5,
  },
  friendList: {
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestsInfoContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'gray',
  },
  requestsInfoText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  requestsContainer: {
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendRequestButtonsContainer: {
    width: '45%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 5,
  },
  handleRequestButton: {
    width: '50%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    margin: 2,
  },
  acceptRequestButton: {
    backgroundColor: 'green',
  },
  rejectRequestButton: {
    backgroundColor: 'red',
  },
  handleRequestButtonText: {
    width: '100%',
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '400',
  },
  handleRequestText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '400',
  },
  cancelRequestImage: {
    height: '110%',
    width: '110%',
    tintColor: 'white',
  },
  friendRequestPendingContainer: {
    width: '45%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  newRequestContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    height: 50,
    width: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 10,
  },
  newRequestButton: {
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  newRequestText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'center',
  },
  searchScreenButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 50,
    width: 70,
    height: 70,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'black',
  },
  searchScreenImage: {
    width: 30,
    height: 30,
    tintColor: 'black',
    alignItems: 'center',
  },
});
