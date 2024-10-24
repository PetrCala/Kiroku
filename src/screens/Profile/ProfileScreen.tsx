import {
  Dimensions,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import commonStyles from '@styles/commonStyles';
import {useFirebase} from '@context/global/FirebaseContext';
import type {StatData} from '@components/Items/StatOverview';
import {StatsOverview} from '@components/Items/StatOverview';
import ProfileOverview from '@components/Social/ProfileOverview';
import React, {useEffect, useMemo, useReducer} from 'react';
import {readDataOnce} from '@database/baseFunctions';
import {
  calculateThisMonthUnits,
  dateToDateObject,
  getSingleMonthDrinkingSessions,
  objKeys,
  roundToTwoDecimalPlaces,
  timestampToDate,
  timestampToDateString,
} from '@libs/DataHandling';
import type {DateObject} from '@src/types/time';
import SessionsCalendar from '@components/Calendar';
import {getCommonFriendsCount} from '@libs/FriendUtils';
import ManageFriendPopup from '@components/Popups/Profile/ManageFriendPopup';
import type {DrinkingSessionArray} from '@src/types/onyx';
import type {UserList} from '@src/types/onyx/OnyxCommon';
import type {StackScreenProps} from '@react-navigation/stack';
import type {ProfileNavigatorParamList} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import Navigation from '@libs/Navigation/Navigation';
import DBPATHS from '@database/DBPATHS';
import ROUTES from '@src/ROUTES';
import type {DateData} from 'react-native-calendars';
import useFetchData from '@hooks/useFetchData';
import {getPlural} from '@libs/StringUtilsKiroku';
import ScreenWrapper from '@components/ScreenWrapper';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

type State = {
  selfFriends: UserList | undefined;
  friendCount: number;
  commonFriendCount: number;
  visibleDateObject: DateObject;
  drinkingSessionsCount: number;
  unitsConsumed: number;
  manageFriendModalVisible: boolean;
  unfriendModalVisible: boolean;
};

type Action = {
  type: string;
  payload: any;
};

const initialState: State = {
  selfFriends: undefined,
  friendCount: 0,
  commonFriendCount: 0,
  visibleDateObject: dateToDateObject(new Date()),
  drinkingSessionsCount: 0,
  unitsConsumed: 0,
  manageFriendModalVisible: false,
  unfriendModalVisible: false,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_SELF_FRIENDS':
      return {...state, selfFriends: action.payload};
    case 'SET_FRIEND_COUNT':
      return {...state, friendCount: action.payload};
    case 'SET_COMMON_FRIEND_COUNT':
      return {...state, commonFriendCount: action.payload};
    case 'SET_VISIBLE_DATE_OBJECT':
      return {...state, visibleDateObject: action.payload};
    case 'SET_DRINKING_SESSIONS_COUNT':
      return {...state, drinkingSessionsCount: action.payload};
    case 'SET_UNITS_CONSUMED':
      return {...state, unitsConsumed: action.payload};
    case 'SET_MANAGE_FRIEND_MODAL_VISIBLE':
      return {...state, manageFriendModalVisible: action.payload};
    case 'SET_UNFRIEND_MODAL_VISIBLE':
      return {...state, unfriendModalVisible: action.payload};
    default:
      return state;
  }
};

type ProfileScreenOnyxProps = {};

type ProfileScreenProps = ProfileScreenOnyxProps &
  StackScreenProps<ProfileNavigatorParamList, typeof SCREENS.PROFILE.ROOT>;

function ProfileScreen({route}: ProfileScreenProps) {
  const {auth, db} = useFirebase();
  const {userID} = route.params;
  const user = auth.currentUser;
  const relevantDataKeys: FetchDataKeys = [
    'userData',
    'drinkingSessionData',
    'preferences',
  ]; //
  const [state, dispatch] = useReducer(reducer, initialState);
  const {translate} = useLocalize();
  const {data: fetchedData, isLoading} = useFetchData(userID, relevantDataKeys);
  let userData = fetchedData?.userData;
  let drinkingSessionData = fetchedData?.drinkingSessionData;
  let preferences = fetchedData?.preferences;
  const profileData = userData?.profile;
  const friends = userData?.friends;

  const statsData: StatData = [
    {
      header: `Drinking Session${getPlural(state.drinkingSessionsCount)}`,
      content: String(state.drinkingSessionsCount),
    },
    {
      header: 'Units Consumed',
      content: String(roundToTwoDecimalPlaces(state.unitsConsumed)),
    },
  ];

  // Track own friends
  useEffect(() => {
    const getOwnFriends = async () => {
      if (!user) {
        return;
      }
      let ownFriends = friends;
      if (user?.uid !== userID) {
        ownFriends = await readDataOnce(
          db,
          DBPATHS.USERS_USER_ID_FRIENDS.getRoute(user.uid),
        );
      }
      dispatch({type: 'SET_SELF_FRIENDS', payload: ownFriends});
    };
    getOwnFriends();
  }, []);

  // Monitor friends count
  useMemo(() => {
    const friendCount = friends ? objKeys(friends).length : 0;
    const commonFriendCount = getCommonFriendsCount(
      objKeys(state.selfFriends),
      objKeys(friends),
    );
    dispatch({type: 'SET_FRIEND_COUNT', payload: friendCount});
    dispatch({type: 'SET_COMMON_FRIEND_COUNT', payload: commonFriendCount});
  }, [friends]);

  // Monitor stats
  useMemo(() => {
    if (!drinkingSessionData || !preferences) {
      return;
    }
    const drinkingSessionArray: DrinkingSessionArray =
      Object.values(drinkingSessionData);

    const thisMonthUnits = calculateThisMonthUnits(
      state.visibleDateObject,
      drinkingSessionArray,
      preferences.drinks_to_units,
    );
    const thisMonthSessionCount = getSingleMonthDrinkingSessions(
      timestampToDate(state.visibleDateObject.timestamp),
      drinkingSessionArray,
      false,
    ).length; // Replace this in the future

    dispatch({
      type: 'SET_DRINKING_SESSIONS_COUNT',
      payload: thisMonthSessionCount,
    });
    dispatch({type: 'SET_UNITS_CONSUMED', payload: thisMonthUnits});
  }, [drinkingSessionData, preferences, state.visibleDateObject]);

  if (isLoading) {
    return <FullScreenLoadingIndicator />;
  }
  if (!profileData || !preferences || !userData) {
    return;
  }

  return (
    <ScreenWrapper testID={ProfileScreen.displayName}>
      <HeaderWithBackButton
        title={
          user?.uid === userID
            ? translate('profileScreen.title')
            : translate('profileScreen.titleNotSelf')
        }
        onBackButtonPress={Navigation.goBack}
      />
      <ScrollView
        style={localStyles.scrollView}
        onScrollBeginDrag={Keyboard.dismiss}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <ProfileOverview
          userID={userID}
          profileData={profileData} // For live propagation of current user
        />
        <View style={localStyles.friendsInfoContainer}>
          <View style={localStyles.leftContainer}>
            <Text style={localStyles.friendsInfoHeading}>
              {`${
                user?.uid !== userID && state.commonFriendCount > 0
                  ? 'Common f'
                  : 'F'
              }riends:`}
            </Text>
            <Text
              style={[
                localStyles.friendsInfoText,
                commonStyles.smallMarginLeft,
              ]}>
              {user?.uid !== userID && state.commonFriendCount > 0
                ? state.commonFriendCount
                : state.friendCount}
            </Text>
          </View>
          <View style={localStyles.rightContainer}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                user?.uid === userID
                  ? Navigation.navigate(ROUTES.SOCIAL)
                  : Navigation.navigate(
                      ROUTES.PROFILE_FRIENDS_FRIENDS.getRoute(userID),
                    );
              }}
              style={localStyles.seeFriendsButton}>
              <Text
                style={[localStyles.friendsInfoText, commonStyles.linkText]}>
                See all friends
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={commonStyles.horizontalLine} />
        <View style={localStyles.statsOverviewHolder}>
          <StatsOverview statsData={statsData} />
        </View>
        <SessionsCalendar
          drinkingSessionData={drinkingSessionData}
          preferences={preferences}
          visibleDateObject={state.visibleDateObject}
          dispatch={dispatch}
          onDayPress={(day: DateData) => {
            user?.uid === userID
              ? Navigation.navigate(
                  ROUTES.DAY_OVERVIEW.getRoute(
                    timestampToDateString(day.timestamp),
                  ),
                )
              : null;
          }}
        />
        <View style={localStyles.bottomContainer}>
          {user?.uid !== userID ? (
            <TouchableOpacity
              accessibilityRole="button"
              style={localStyles.manageFriendButton}
              onPress={() =>
                dispatch({
                  type: 'SET_MANAGE_FRIEND_MODAL_VISIBLE',
                  payload: true,
                })
              }>
              <Text style={localStyles.manageFriendButtonText}>Manage</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={{height: 200, backgroundColor: '#ffff99'}}></View>
      </ScrollView>
      <ManageFriendPopup
        visible={state.manageFriendModalVisible}
        setVisibility={(visible: boolean) =>
          dispatch({type: 'SET_MANAGE_FRIEND_MODAL_VISIBLE', payload: visible})
        }
        onGoBack={() => Navigation.goBack()}
        friendId={userID}
      />
    </ScreenWrapper>
  );
}

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;

const localStyles = StyleSheet.create({
  sectionText: {
    fontSize: 20,
    color: 'black',
    fontWeight: 'bold',
    margin: 10,
    textAlign: 'center',
  },
  scrollView: {
    backgroundColor: '#ffff99',
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
  },
  editProfileButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    width: 'auto',
    height: 'auto',
    backgroundColor: 'pink',
    zIndex: -2,
  },
  editProfileIcon: {
    width: 24,
    height: 24,
    tintColor: '#1A3D32',
    backgroundColor: 'blue',
    zIndex: -3,
  },
  friendsInfoContainer: {
    width: '90%',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    margin: 10,
  },
  friendsInfoHeading: {
    fontSize: 16,
    color: 'black',
    fontWeight: '500',
    textAlign: 'center',
  },
  friendsInfoText: {
    fontSize: 16,
    color: 'black',
    textAlign: 'center',
  },
  leftContainer: {
    width: '60%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  rightContainer: {
    width: '40%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  seeFriendsButton: {
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsOverviewHolder: {
    height: 120,
    flexDirection: 'row',
    width: screenWidth,
  },
  bottomContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  manageFriendButton: {
    width: '30%',
    height: 40,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'black',
    margin: 10,
  },
  manageFriendButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
  },
});

ProfileScreen.displayName = 'Profile Screen';

export default ProfileScreen;
