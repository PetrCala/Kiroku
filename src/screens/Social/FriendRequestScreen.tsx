import {View} from 'react-native';
import type {
  FriendRequestList,
  FriendRequestStatus,
  ProfileList,
} from '@src/types/onyx';
import {useCallback, useEffect, useRef, useState} from 'react';
import * as ErrorUtils from '@libs/ErrorUtils';
import {useFirebase} from '@context/global/FirebaseContext';
import * as Friends from '@userActions/Friends';
import NoFriendUserOverview from '@components/Social/NoFriendUserOverview';
import FriendOfflineFeedback from '@components/Social/FriendOfflineFeedback';
import * as Profile from '@userActions/Profile';
import GrayHeader from '@components/Header/GrayHeader';
import {objKeys} from '@libs/DataHandling';
import CONST from '@src/CONST';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useNetwork from '@hooks/useNetwork';
import NoFriendInfo from '@components/Social/NoFriendInfo';
import {isEmptyArray, isEmptyObject} from '@src/types/utils/EmptyObject';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import ScrollView from '@components/ScrollView';
import Button from '@components/Button';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
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
  const {auth} = useFirebase();
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
        Friends.acceptFriendRequest(requestId);
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
        Friends.deleteFriendRequest(requestId);
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
  const {auth} = useFirebase();
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
        Friends.deleteFriendRequest(requestId);
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
    <FriendOfflineFeedback
      key={`${requestId}-friend-request`}
      userID={requestId}>
      <NoFriendUserOverview
        userID={requestId}
        profileData={profileData}
        RightSideComponent={FriendRequestComponent({
          requestId,
          requestStatus,
        })}
      />
    </FriendOfflineFeedback>
  );
}

function FriendRequestScreen() {
  const userData = useCurrentUserData();
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  const [hasResolvedInitial, setHasResolvedInitial] = useState<boolean>(false);
  const [friendRequests, setFriendRequests] = useState<
    FriendRequestList | undefined
  >();
  const [requestsSent, setRequestsSent] = useState<string[]>([]);
  // Request ids whose profile fetch is in flight, so a re-run (e.g. when an
  // unrelated USER_DATA_LIST merge lands) doesn't re-request the same ids.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [requestsReceived, setRequestsReceived] = useState<string[]>([]);
  const [requestsSentCount, setRequestsSentCount] = useState<number>(0);
  const [requestsReceivedCount, setRequestsReceivedCount] = useState<number>(0);

  useEffect(() => {
    if (!userData) {
      return;
    }
    setFriendRequests(userData?.friend_requests);
  }, [userData]);

  // Render request profiles straight from the shared USER_DATA_LIST cache, so a
  // revisit (or a profile already pulled by the friend list) paints instantly.
  const requestIDs = objKeys(friendRequests);
  const displayData: ProfileList = {};
  for (const requestId of requestIDs) {
    const profile = userDataList?.[requestId]?.profile;
    if (profile) {
      displayData[requestId] = profile;
    }
  }

  // Fetch only the request profiles we don't already have cached and aren't
  // already fetching — replacing the old "re-fetch every request on any change"
  // path. One batched call, deduped against Onyx + the in-flight set.
  const fetchMissingProfiles = useCallback(() => {
    const missingIDs = objKeys(friendRequests).filter(
      id => !userDataList?.[id]?.profile && !inFlightRef.current.has(id),
    );
    if (isEmptyArray(missingIDs)) {
      // Nothing to fetch. Leave the cold gate alone: an empty request set, or
      // one whose profiles are all cached, already resolves `isLoading` to false
      // below without it (and resolving it during the transient empty render
      // would suppress the spinner for the real requests).
      return;
    }
    missingIDs.forEach(id => inFlightRef.current.add(id));
    Profile.fetchUserProfiles(missingIDs).finally(() => {
      missingIDs.forEach(id => inFlightRef.current.delete(id));
      setHasResolvedInitial(true);
    });
  }, [friendRequests, userDataList]);

  useEffect(() => {
    fetchMissingProfiles();
  }, [fetchMissingProfiles]);

  // Re-issue the missing-profile read when connectivity resumes.
  // `fetchUserProfiles` goes through `makeRequestWithSideEffects`, which DISCARDS
  // a read while offline instead of queueing it (unlike `API.write`), and the
  // effect above is keyed on data identity (`friendRequests`/`userDataList`) so
  // it never re-runs on reconnect — without this an offline mount leaves the
  // request profiles missing after going back online. The shared dedupe (Onyx +
  // in-flight set) means the reconnect call only fetches what's still missing.
  useNetwork({
    onReconnect: () => fetchMissingProfiles(),
  });

  // Cold-load gate only: show the spinner just for the first load of a request
  // set with nothing cached yet — never blank the list out on a later refresh.
  const isLoading =
    requestIDs.length > 0 && isEmptyObject(displayData) && !hasResolvedInitial;

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
    </View>
  );
}

export default FriendRequestScreen;
