import {View} from 'react-native';
import type {
  FriendRequestList,
  FriendRequestStatus,
  ProfileList,
} from '@src/types/onyx';
import {useEffect, useState} from 'react';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import * as ErrorUtils from '@libs/ErrorUtils';
import {useFirebase} from '@context/global/FirebaseContext';
import {acceptFriendRequest, deleteFriendRequest} from '@database/friends';
import type {Database} from 'firebase/database';
import NoFriendUserOverview from '@components/Social/NoFriendUserOverview';
import * as Profile from '@userActions/Profile';
import GrayHeader from '@components/Header/GrayHeader';
import {objKeys} from '@libs/DataHandling';
import CONST from '@src/CONST';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import NoFriendInfo from '@components/Social/NoFriendInfo';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import Icon from '@components/Icon';
import useTheme from '@hooks/useTheme';
import ScrollView from '@components/ScrollView';
import Button from '@components/Button';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import {PressableWithFeedback} from '@components/Pressable';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import ERRORS from '@src/ERRORS';

type FriendRequestButtonsProps = {
  requestId: UserID;
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

// Component to be shown for a received friend request
function FriendRequestButtons({requestId}: FriendRequestButtonsProps) {
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  if (!user) {
    return;
  }

  const handleAcceptPress = () => {
    (async () => {
      try {
        setIsLoading(true);
        await acceptFriendRequest(db, user.uid, requestId);
        setIsLoading(false);
      } catch (error) {
        ErrorUtils.raiseAppError(
          ERRORS.USER.FRIEND_REQUEST_ACCEPT_FAILED,
          error,
        );
      }
    })();
  };

  const handleRejectPress = () => {
    (async () => {
      try {
        setIsLoading(true);
        await deleteFriendRequest(db, user.uid, requestId);
        setIsLoading(false);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.USER.FEEDBACK_REMOVAL_FAILED, error);
      }
    })();
  };

  return (
    <View style={[styles.flexRow, styles.alignItemsCenter]}>
      <Button
        success
        key={`${requestId}-accept-request-button`}
        text={translate('friendRequestScreen.accept')}
        onPress={handleAcceptPress}
        isLoading={isLoading}
      />
      <Button
        danger
        key={`${requestId}-reject-request-button`}
        text={translate('friendRequestScreen.remove')}
        onPress={handleRejectPress}
        style={styles.ml1}
        isLoading={isLoading}
      />
    </View>
  );
}

// Component to be shown when the friend request is pending
function FriendRequestPending({requestId}: FriendRequestButtonsProps) {
  const {auth, db} = useFirebase();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const user = auth.currentUser;

  if (!user) {
    return;
  }

  const handleRejectPress = () => {
    (async () => {
      try {
        setIsLoading(true);
        await deleteFriendRequest(db, user.uid, requestId);
        setIsLoading(false);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.USER.FEEDBACK_REMOVAL_FAILED, error);
      }
    })();
  };

  return (
    <View style={[styles.flexRow, styles.alignItemsCenter]}>
      <Button
        danger
        onPress={handleRejectPress}
        text={translate('common.cancel')}
        isLoading={isLoading}
      />
    </View>
  );
}

// Component to be rendered on the right hand side of each friend request container
function FriendRequestComponent({
  requestStatus,
  requestId,
}: FriendRequestComponentProps) {
  switch (requestStatus) {
    case CONST.FRIEND_REQUEST_STATUS.RECEIVED:
      return (
        <FriendRequestButtons
          key={`${requestId}-friend-request-buttons`}
          requestId={requestId}
        />
      );
    case CONST.FRIEND_REQUEST_STATUS.SENT:
      return (
        <FriendRequestPending
          key={`${requestId}-friend-request-pending`}
          requestId={requestId}
        />
      );
    default:
      return null;
  }
}

function FriendRequestItem({
  requestId,
  friendRequests,
  displayData,
}: FriendRequestItemProps) {
  if (!friendRequests || !displayData) {
    return null;
  }
  const profileData = displayData[requestId];
  const requestStatus = friendRequests[requestId];

  return (
    <NoFriendUserOverview
      key={`${requestId}-friend-request`}
      userID={requestId}
      profileData={profileData}
      RightSideComponent={FriendRequestComponent({
        requestId,
        requestStatus,
      })}
    />
  );
}

function FriendRequestScreen() {
  const {db} = useFirebase();
  const {userData} = useDatabaseData();
  const theme = useTheme();
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [friendRequests, setFriendRequests] = useState<
    FriendRequestList | undefined
  >();
  const [displayData, setDisplayData] = useState<ProfileList>({});
  const [requestsSent, setRequestsSent] = useState<string[]>([]);
  const [requestsReceived, setRequestsReceived] = useState<string[]>([]);
  const [requestsSentCount, setRequestsSentCount] = useState<number>(0);
  const [requestsReceivedCount, setRequestsReceivedCount] = useState<number>(0);

  useEffect(() => {
    if (!userData) {
      return;
    }
    setFriendRequests(userData?.friend_requests);
  }, [userData]);

  const updateDisplayData = async (
    database: Database,
    requests: FriendRequestList | undefined,
  ): Promise<void> => {
    const newDisplayData: ProfileList = await Profile.fetchUserProfiles(
      database,
      objKeys(requests),
    );
    setDisplayData(newDisplayData);
  };

  useEffect(() => {
    const updateLocalHooks = async () => {
      setIsLoading(true);
      await updateDisplayData(db, friendRequests);
      setIsLoading(false);
    };
    updateLocalHooks();
  }, [friendRequests, db]);

  useEffect(() => {
    const newRequestsSent: string[] = [];
    const newRequestsReceived: string[] = [];
    if (!isEmptyObject(friendRequests)) {
      Object.keys(friendRequests).forEach(requestId => {
        if (!friendRequests) {
          return;
        }
        if (friendRequests[requestId] === CONST.FRIEND_REQUEST_STATUS.SENT) {
          newRequestsSent.push(requestId);
        } else if (
          friendRequests[requestId] === CONST.FRIEND_REQUEST_STATUS.RECEIVED
        ) {
          newRequestsReceived.push(requestId);
        }
      });
    }
    const newRequestsSentCount = newRequestsSent.length;
    const newRequestsReceivedCount = newRequestsReceived.length;

    setRequestsSent(newRequestsSent);
    setRequestsReceived(newRequestsReceived);
    setRequestsSentCount(newRequestsSentCount);
    setRequestsReceivedCount(newRequestsReceivedCount);
  }, [friendRequests]);

  return (
    <View style={styles.flex1}>
      <ScrollView style={[styles.mw100]}>
        {isLoading || !!loadingText ? (
          <FlexibleLoadingIndicator style={styles.mt5} />
        ) : (
          <View>
            {!isEmptyObject(friendRequests) ? (
              <View>
                <GrayHeader
                  headerText={translate(
                    'friendRequestScreen.requestsReceived',
                    {requestsCount: requestsReceivedCount},
                  )}
                />
                <View>
                  {requestsReceived.map(requestId => (
                    <FriendRequestItem
                      key={`${requestId}-friend-request-item`}
                      requestId={requestId}
                      friendRequests={friendRequests}
                      displayData={displayData}
                    />
                  ))}
                </View>
                <GrayHeader
                  headerText={translate('friendRequestScreen.requestsSent', {
                    requestsCount: requestsSentCount,
                  })}
                />
                <View>
                  {requestsSent.map(requestId => (
                    <FriendRequestItem
                      key={`${requestId}-friend-request-item`}
                      requestId={requestId}
                      friendRequests={friendRequests}
                      displayData={displayData}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <NoFriendInfo
                message={translate('friendRequestScreen.lookingForNewFriends')}
                buttonText={translate('friendRequestScreen.trySearchingHere')}
              />
            )}
          </View>
        )}
      </ScrollView>
      <PressableWithFeedback
        accessibilityLabel="search-screen-button"
        style={styles.goToSearchScreenButton}
        onPress={() => Navigation.navigate(ROUTES.SOCIAL_FRIEND_SEARCH)}>
        <Icon
          src={KirokuIcons.Search}
          width={28}
          height={28}
          fill={theme.textLight}
        />
      </PressableWithFeedback>
    </View>
  );
}

export default FriendRequestScreen;
