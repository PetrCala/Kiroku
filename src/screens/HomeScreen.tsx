import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Onyx, {useOnyx} from 'react-native-onyx';
import MenuIcon from '@components/Buttons/MenuIcon';
import SessionsCalendar from '@components/Calendar';
import type {DateObject} from '@src/types/time';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {
  dateToDateObject,
  calculateThisMonthDrinks,
  calculateThisMonthUnits,
  getSingleMonthDrinkingSessions,
  timestampToDate,
  timestampToDateString,
  roundToTwoDecimalPlaces,
} from '@libs/DataHandling';
import {useUserConnection} from '@context/global/UserConnectionContext';
import UserOffline from '@components/UserOffline';
import {synchronizeUserStatus} from '@database/users';
import {startLiveDrinkingSession} from '@database/drinkingSessions';
import commonStyles from '@src/styles/commonStyles';
import {useFirebase} from '@context/global/FirebaseContext';
import ProfileImage from '@components/ProfileImage';
import {generateDatabaseKey} from '@database/baseFunctions';
import CONST from '@src/CONST';
import type {
  DrinkingSession,
  DrinkingSessionArray,
  DrinkingSessionId,
} from '@src/types/onyx';
import ROUTES from '@src/ROUTES';
import Navigation, {navigationRef} from '@navigation/Navigation';
import type {StackScreenProps} from '@react-navigation/stack';
import {useFocusEffect} from '@react-navigation/native';
import type {BottomTabNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import type {DateData} from 'react-native-calendars';
import DBPATHS from '@database/DBPATHS';
import type {StatData} from '@components/Items/StatOverview';
import {StatsOverview} from '@components/Items/StatOverview';
import {getPlural} from '@libs/StringUtilsKiroku';
import {getReceivedRequestsCount} from '@libs/FriendUtils';
import FriendRequestCounter from '@components/Social/FriendRequestCounter';
import ScreenWrapper from '@components/ScreenWrapper';
import MessageBanner from '@components/Info/MessageBanner';
import VerifyEmailPopup from '@components/Popups/VerifyEmailPopup';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import getPlatform from '@libs/getPlatform';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import DSUtils from '@libs/DrinkingSessionUtils';

type State = {
  visibleDateObject: DateObject;
  drinkingSessionsCount: number;
  drinksConsumed: number;
  unitsConsumed: number;
  initializingSession: boolean;
  ongoingSessionId: DrinkingSessionId | undefined;
  verifyEmailModalVisible: boolean;
  shouldNavigateToTzFix: boolean;
};

type Action = {
  type: string;
  payload: any;
};

const initialState: State = {
  visibleDateObject: dateToDateObject(new Date()),
  drinkingSessionsCount: 0,
  drinksConsumed: 0,
  unitsConsumed: 0,
  initializingSession: false,
  ongoingSessionId: undefined,
  verifyEmailModalVisible: false,
  shouldNavigateToTzFix: false,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_VISIBLE_DATE_OBJECT':
      return {...state, visibleDateObject: action.payload};
    case 'SET_DRINKING_SESSIONS_COUNT':
      return {...state, drinkingSessionsCount: action.payload};
    case 'SET_DRINKS_CONSUMED':
      return {...state, drinksConsumed: action.payload};
    case 'SET_UNITS_CONSUMED':
      return {...state, unitsConsumed: action.payload};
    case 'SET_INITIALIZING_SESSION':
      return {...state, initializingSession: action.payload};
    case 'SET_ONGOING_SESSION_ID':
      return {...state, ongoingSessionId: action.payload};
    case 'SET_VERIFY_EMAIL_MODAL_VISIBLE':
      return {...state, verifyEmailModalVisible: action.payload};
    case 'SET_SHOULD_NAVIGATE_TO_TZ_FIX':
      return {...state, shouldNavigateToTzFix: action.payload};
    default:
      return state;
  }
};

type HomeScreenOnyxProps = {};

type HomeScreenProps = HomeScreenOnyxProps &
  StackScreenProps<BottomTabNavigatorParamList, typeof SCREENS.HOME>;

function HomeScreen({route}: HomeScreenProps) {
  const styles = useThemeStyles();
  const {auth, db, storage} = useFirebase();
  const user = auth.currentUser;
  const {isOnline} = useUserConnection();
  const {
    userStatusData,
    drinkingSessionData,
    preferences,
    userData,
    isLoading,
  } = useDatabaseData();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [preferredTheme] = useOnyx(ONYXKEYS.PREFERRED_THEME);
  const {translate} = useLocalize();

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

  // Handle drinking session button press
  const startDrinkingSession = async () => {
    if (!user) {
      return null;
    }
    if (state.ongoingSessionId) {
      Alert.alert(
        'A session already exists',
        "You can't start a new session while you are in one",
      );
      return;
    }
    dispatch({type: 'SET_INITIALIZING_SESSION', payload: true});
    // The user is not in an active session
    const newSessionData: DrinkingSession = DSUtils.getEmptySession(
      CONST.SESSION_TYPES.LIVE,
      true,
      true,
    );
    const newSessionId = generateDatabaseKey(
      db,
      DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(user.uid),
    );
    if (!newSessionId) {
      Alert.alert(
        'New session key generation failed',
        "Couldn't generate a new session key",
      );
      return;
    }
    try {
      await startLiveDrinkingSession(
        db,
        user.uid,
        newSessionData,
        newSessionId,
      );
      Navigation.navigate(ROUTES.DRINKING_SESSION_LIVE.getRoute(newSessionId));
      dispatch({type: 'SET_ONGOING_SESSION_ID', payload: newSessionId});
    } catch (error: any) {
      Alert.alert(
        'New session initialization failed',
        'Could not start a new session: ' + error.message,
      );
      return;
    } finally {
      dispatch({type: 'SET_INITIALIZING_SESSION', payload: false});
    }
  };

  const openSessionInProgress = () => {
    if (!state.ongoingSessionId) {
      Alert.alert(
        'New session initialization failed',
        'Could not find the existing session',
      );
      return;
    }
    Navigation.navigate(
      ROUTES.DRINKING_SESSION_LIVE.getRoute(state.ongoingSessionId),
    );
  };

  // Monitor visible month and various statistics
  useMemo(() => {
    if (!preferences) {
      return;
    }
    const drinkingSessionArray: DrinkingSessionArray = drinkingSessionData
      ? Object.values(drinkingSessionData)
      : [];
    const thisMonthDrinks = calculateThisMonthDrinks(
      state.visibleDateObject,
      drinkingSessionArray,
    );
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
    dispatch({type: 'SET_DRINKS_CONSUMED', payload: thisMonthDrinks});
    dispatch({type: 'SET_UNITS_CONSUMED', payload: thisMonthUnits});
  }, [drinkingSessionData, state.visibleDateObject, preferences]);

  useMemo(() => {
    const sessionsAreMissingTz =
      !DSUtils.allSessionsContainTimezone(drinkingSessionData);

    // Only navigate in case the user is setting up TZ for the first time
    const shouldNavigateToTzFix =
      sessionsAreMissingTz && !!!userData?.private_data?.timezone;

    dispatch({
      type: 'SET_SHOULD_NAVIGATE_TO_TZ_FIX',
      payload: shouldNavigateToTzFix,
    });
  }, [drinkingSessionData]);

  useEffect(() => {
    if (!userStatusData) {
      return;
    }

    const currentSessionId: DrinkingSessionId | undefined = userStatusData
      .latest_session?.ongoing
      ? userStatusData.latest_session_id
      : undefined;

    dispatch({
      type: 'SET_ONGOING_SESSION_ID',
      payload: currentSessionId,
    });
  }, [userStatusData]);

  useFocusEffect(
    React.useCallback(() => {
      // Update user status on home screen focus
      if (!user || !userData || !preferences || !drinkingSessionData) {
        return;
      }
      try {
        synchronizeUserStatus(
          db,
          user.uid,
          userStatusData,
          drinkingSessionData,
        );
      } catch (error: any) {
        Alert.alert(
          'Failed to contact the database',
          'Could not update user online status:' + error.message,
        );
      }
      // TZFIX (09-2024) - Redirect to TZ_FIX_INTRODUCTION if user has not set timezone
      if (!state.shouldNavigateToTzFix) {
        Navigation.navigate(ROUTES.TZ_FIX_INTRODUCTION);
      }
    }, [userData, preferences, drinkingSessionData]),
  );

  if (!user) {
    Navigation.navigate(ROUTES.SIGNUP);
    return;
  }
  if (!isOnline) {
    return <UserOffline />;
  }
  if (
    isLoading ||
    state.initializingSession ||
    !preferences ||
    !userData ||
    !userStatusData
  ) {
    return (
      <FullScreenLoadingIndicator
        loadingText={
          (state.initializingSession && 'Starting a new session...') || ''
        }
      />
    );
  }

  return (
    <ScreenWrapper
      testID={HomeScreen.displayName}
      includePaddingTop={false}
      includeSafeAreaPaddingBottom={getPlatform() !== CONST.PLATFORM.IOS}>
      <View style={commonStyles.headerContainer}>
        {userData && (
          <View style={localStyles.profileContainer}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() =>
                Navigation.navigate(ROUTES.PROFILE.getRoute(user.uid))
              }
              style={localStyles.profileButton}>
              <ProfileImage
                storage={storage}
                userID={user.uid}
                downloadPath={userData.profile.photo_url}
                style={localStyles.profileImage}
                // refreshTrigger={refreshCounter}
                refreshTrigger={0}
              />
              <Text style={[styles.headerText, styles.textLarge, styles.ml3]}>
                {user.displayName}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Enable later on */}
        {/* <View style={localStyles.menuContainer}>
          <TouchableOpacity style={localStyles.notificationsButton}>
            <Image source={KirokuIcons.Bell} style={localStyles.notificationsIcon} />
          </TouchableOpacity>
        </View> */}
      </View>
      <ScrollView
        style={localStyles.mainScreenContent}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}>
        {state.ongoingSessionId ? (
          <MessageBanner
            text="You are currently in session!"
            onPress={openSessionInProgress}
          />
        ) : null}
        {/* User verification modal -- Enable later on
        {user.emailVerified ? null : (
          <MessageBanner
            text="Your email is not verified!"
            onPress={() =>
              dispatch({type: 'SET_VERIFY_EMAIL_MODAL_VISIBLE', payload: true})
            }
          />
        )} */}
        <View style={localStyles.statsOverviewHolder}>
          <StatsOverview statsData={statsData} />
        </View>

        <SessionsCalendar
          drinkingSessionData={drinkingSessionData}
          preferences={preferences}
          visibleDateObject={state.visibleDateObject}
          dispatch={dispatch}
          onDayPress={(day: DateData) => {
            Navigation.navigate(
              ROUTES.DAY_OVERVIEW.getRoute(
                timestampToDateString(day.timestamp),
              ),
            );
          }}
        />
        <View style={{height: 200}}></View>
      </ScrollView>
      <View style={commonStyles.mainFooter}>
        <View
          style={[
            localStyles.mainScreenFooterHalfContainer,
            localStyles.mainScreenFooterLeftContainer,
          ]}>
          <View style={localStyles.socialContainer}>
            <MenuIcon
              iconId="social-icon"
              iconSource={KirokuIcons.Social}
              containerStyle={localStyles.menuIconContainer}
              iconStyle={localStyles.menuIcon}
              onPress={() => Navigation.navigate(ROUTES.SOCIAL)}
            />
            <FriendRequestCounter
              count={getReceivedRequestsCount(userData?.friend_requests)}
              style={localStyles.friendRequestCounter}
            />
          </View>
          <MenuIcon
            iconId="achievement-icon"
            iconSource={KirokuIcons.Achievements}
            containerStyle={localStyles.menuIconContainer}
            iconStyle={localStyles.menuIcon}
            onPress={() => Navigation.navigate(ROUTES.ACHIEVEMENTS)}
          />
        </View>
        <View
          style={[
            localStyles.mainScreenFooterHalfContainer,
            localStyles.mainScreenFooterRightContainer,
          ]}>
          <MenuIcon
            iconId="settings-popup-icon"
            iconSource={KirokuIcons.Statistics}
            containerStyle={localStyles.menuIconContainer}
            iconStyle={localStyles.menuIcon}
            onPress={() => Navigation.navigate(ROUTES.STATISTICS)}
          />
          <MenuIcon
            iconId="settings-popup-icon"
            iconSource={KirokuIcons.BarMenu}
            containerStyle={localStyles.menuIconContainer}
            iconStyle={localStyles.menuIcon}
            onPress={() => Navigation.navigate(ROUTES.SETTINGS)}
          />
        </View>
      </View>
      {state.ongoingSessionId ? null : (
        <TouchableOpacity
          accessibilityRole="button"
          style={localStyles.startSessionButton}
          onPress={startDrinkingSession}>
          <Image
            source={KirokuIcons.Plus}
            style={localStyles.startSessionImage}
          />
        </TouchableOpacity>
      )}
      <VerifyEmailPopup
        visible={state.verifyEmailModalVisible}
        onRequestClose={() =>
          dispatch({
            type: 'SET_VERIFY_EMAIL_MODAL_VISIBLE',
            payload: false,
          })
        }
      />
    </ScreenWrapper>
  );
}

const screenWidth = Dimensions.get('window').width;
const currentPlatform = getPlatform();
const iconSize = currentPlatform === CONST.PLATFORM.IOS ? 48 : 28;

const localStyles = StyleSheet.create({
  profileContainer: {
    //Ensure the container fills all space between, no more, no less
    padding: 10,
    height: '100%',
    width: '85%',
  },
  profileButton: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  headerUsername: {
    flexWrap: 'wrap',
    fontSize: 18,
    fontWeight: '500',
    color: 'black',
    marginLeft: 10,
    alignSelf: 'center',
  },
  menuContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '15%',
  },
  menuIconContainer: {
    width: 'auto',
    height: 'auto',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    width: iconSize,
    height: iconSize,
    padding: 10,
  },
  notificationsButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationsIcon: {
    width: 24,
    height: 24,
  },
  socialContainer: {
    flexDirection: 'row',
  },
  friendRequestCounter: {
    marginLeft: -4,
    marginRight: 4,
  },
  mainScreenContent: {
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: '#ffff99',
  },
  userInSessionWarningContainer: {
    backgroundColor: '#ff5d54',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
    borderColor: '#ddd',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    alignItems: 'center',
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userInSessionWarningText: {
    fontSize: 22,
    color: '#ffffff', // White color for the text
    fontWeight: 'bold',
  },
  statsOverviewHolder: {
    height: 120,
    flexDirection: 'row',
    width: screenWidth,
  },
  menuInfoContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    width: '100%',
    marginTop: 2,
  },
  menuInfoItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  menuInfoHeadingText: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '500',
    color: 'black',
    padding: 5,
  },
  menuInfoText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
    alignSelf: 'center',
    padding: 6,
    marginRight: 4,
    marginLeft: 4,
  },
  thisMonthUnitsText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: 'black',
    alignSelf: 'center',
    alignContent: 'center',
  },
  startSessionButton: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{translateX: -35}],
    borderRadius: 50,
    width: 70,
    height: 70,
    backgroundColor: 'green',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'black',
  },
  startSessionImage: {
    width: 30,
    height: 30,
    tintColor: 'white',
    alignItems: 'center',
    // color: 'white',
    // fontSize: 50,
    // fontWeight: 'bold',
    // textAlign: 'center',
    // lineHeight: 70,
  },
  navigationArrowContainer: {
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
  },
  navigationArrowButton: {
    width: '50%',
    height: 45,
    alignSelf: 'center',
    justifyContent: 'center',
    borderColor: '#ddd',
    borderRadius: 3,
    borderWidth: 1,
    backgroundColor: 'white',
  },
  navigationArrowText: {
    color: 'black',
    fontSize: 30,
    fontWeight: '500',
    textAlign: 'center',
  },
  mainScreenFooterHalfContainer: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: 'shite',
  },
  mainScreenFooterLeftContainer: {
    paddingRight: 30,
  },
  mainScreenFooterRightContainer: {
    paddingLeft: 30,
  },
});

HomeScreen.displayName = 'Home Screen';

export default HomeScreen;
