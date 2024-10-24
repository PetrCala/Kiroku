import React, {useState, useMemo} from 'react';
import {
  Text,
  Image,
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import MenuIcon from '../../components/Buttons/MenuIcon';
import {
  timestampToDate,
  formatDateToDay,
  formatDateToTime,
  changeDateBySomeDays,
  unitsToColors,
  getSingleDayDrinkingSessions,
  sumAllUnits,
  dateStringToDate,
} from '@libs/DataHandling';
// import { PreferencesData} from '../types/database';
import UserOffline from '@components/UserOffline';
import {useUserConnection} from '@context/global/UserConnectionContext';
import type {DrinkingSession, DrinkingSessionList} from '@src/types/onyx';
import {generateDatabaseKey} from '@database/baseFunctions';
import {useFirebase} from '@src/context/global/FirebaseContext';
import MainHeaderButton from '@components/Header/MainHeaderButton';
import type {DrinkingSessionKeyValue} from '@src/types/utils/databaseUtils';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DayOverviewNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import DBPATHS from '@database/DBPATHS';
import DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import {savePlaceholderSessionData} from '@database/drinkingSessions';
import ScreenWrapper from '@components/ScreenWrapper';
import {nonMidnightString} from '@libs/StringUtilsKiroku';
import useLocalize from '@hooks/useLocalize';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useTheme from '@hooks/useTheme';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import useThemeStyles from '@hooks/useThemeStyles';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';

type DayOverviewScreenProps = StackScreenProps<
  DayOverviewNavigatorParamList,
  typeof SCREENS.DAY_OVERVIEW.ROOT
>;

function DayOverviewScreen({route}: DayOverviewScreenProps) {
  const {translate} = useLocalize();
  const theme = useTheme();
  const styles = useThemeStyles();
  const {date} = route.params;
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const {isOnline} = useUserConnection();
  const {drinkingSessionData, preferences} = useDatabaseData();
  const [currentDate, setCurrentDate] = useState<Date>(
    date ? dateStringToDate(date) : new Date(),
  );
  const [editMode, setEditMode] = useState<boolean>(false);
  const [dailyData, setDailyData] = useState<DrinkingSessionKeyValue[]>([]);

  // Monitor the combined data
  useMemo(() => {
    if (!drinkingSessionData) {
      setDailyData([]);
      return;
    }
    const relevantData = getSingleDayDrinkingSessions(
      currentDate,
      drinkingSessionData,
      false,
    ) as DrinkingSessionList;
    const newDailyData = Object.entries(relevantData).map(
      ([sessionId, session]) => {
        return {
          sessionId: sessionId,
          session: session,
        };
      },
    );
    setDailyData(newDailyData);
  }, [currentDate, drinkingSessionData]);

  const onSessionButtonPress = (
    sessionId: string,
    session: DrinkingSession,
  ) => {
    {
      session?.ongoing
        ? Navigation.navigate(ROUTES.DRINKING_SESSION_LIVE.getRoute(sessionId))
        : Navigation.navigate(
            ROUTES.DRINKING_SESSION_SUMMARY.getRoute(sessionId),
          );
    }
  };

  const onEditSessionPress = (sessionId: string) => {
    Navigation.navigate(ROUTES.DRINKING_SESSION_LIVE.getRoute(sessionId));
  };

  const DrinkingSession = ({sessionId, session}: DrinkingSessionKeyValue) => {
    if (!preferences) {
      return;
    }
    // Calculate the session color
    const totalUnits = sumAllUnits(session.drinks, preferences.drinks_to_units);
    const unitsToColorsInfo = preferences.units_to_colors;
    let sessionColor = unitsToColors(totalUnits, unitsToColorsInfo);
    if (session.blackout === true) {
      sessionColor = 'black';
    }
    // Convert the timestamp to a Date object
    const date = timestampToDate(session.start_time);
    const timeString = nonMidnightString(formatDateToTime(date));
    const shouldDisplayTime = session.type === CONST.SESSION_TYPES.LIVE;
    const viewStyle = {
      ...localStyles.menuDrinkingSessionContainer,
      backgroundColor: sessionColor,
    };

    return (
      <View style={viewStyle}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={{flex: 1}}>
            <TouchableOpacity
              accessibilityRole="button"
              style={localStyles.menuDrinkingSessionButton}
              onPress={() => onSessionButtonPress(sessionId, session)}>
              <Text
                style={[
                  localStyles.menuDrinkingSessionText,
                  session.blackout === true || sessionColor === 'red'
                    ? {color: 'white', fontWeight: '500'}
                    : {},
                ]}>
                Units: {totalUnits}
              </Text>
              {shouldDisplayTime && (
                <Text
                  style={[
                    localStyles.menuDrinkingSessionText,
                    session.blackout === true || sessionColor === 'red'
                      ? {color: 'white', fontWeight: '500'}
                      : {},
                  ]}>
                  Time: {nonMidnightString(timeString)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {session?.ongoing ? (
            <View style={localStyles.ongoingSessionContainer}>
              <TouchableOpacity
                accessibilityRole="button"
                style={localStyles.ongoingSessionButton}
                onPress={() => onSessionButtonPress(sessionId, session)}>
                <Text style={localStyles.ongoingSessionText}>In Session</Text>
              </TouchableOpacity>
            </View>
          ) : editMode ? (
            <MenuIcon
              iconId="edit-session-icon"
              iconSource={KirokuIcons.Edit}
              containerStyle={[localStyles.menuIconContainer]}
              iconStyle={[
                localStyles.menuIcon,
                session.blackout === true || sessionColor === 'red'
                  ? {tintColor: 'white'}
                  : {},
              ]}
              onPress={() => onEditSessionPress(sessionId)} // Use keyextractor to load id here
            />
          ) : null}
        </View>
      </View>
    );
  };

  const renderDrinkingSession = ({item}: {item: DrinkingSessionKeyValue}) => {
    return (
      <DrinkingSession sessionId={item.sessionId} session={item.session} />
    );
  };

  const noDrinkingSessionsComponent = () => {
    return (
      <Text style={localStyles.menuDrinkingSessionInfoText}>
        No drinking sessions
      </Text>
    );
  };

  const addSessionButton = () => {
    if (date == null) {
      return <FlexibleLoadingIndicator />;
    }
    if (!editMode || !user) {
      return null;
    } // Do not display outside edit mode
    // No button if the date is in the future
    const today = new Date();
    const tomorrowMidnight = changeDateBySomeDays(today, 1);
    tomorrowMidnight.setHours(0, 0, 0, 0);
    if (currentDate >= tomorrowMidnight) {
      return null;
    }

    /** Generate a placeholder session that corresponds to the current day */
    const getPlaceholderSession = (): DrinkingSession => {
      const timestamp = currentDate.getTime();
      const session: DrinkingSession = DSUtils.getEmptySession(
        CONST.SESSION_TYPES.EDIT,
        true,
        false,
      );
      session.start_time = timestamp;
      session.end_time = timestamp;
      return session;
    };

    const onAddSessionButtonPress = async () => {
      // Generate a new drinking session key
      const newSessionId = generateDatabaseKey(
        db,
        DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(user.uid),
      );
      if (!newSessionId) {
        Alert.alert('Error', 'Could not generate a new session key.');
        return;
      }
      try {
        const placeholderSession = getPlaceholderSession();
        await savePlaceholderSessionData(db, user.uid, placeholderSession);
        Navigation.navigate(
          ROUTES.DRINKING_SESSION_LIVE.getRoute(newSessionId),
        );
      } catch (error: any) {
        Alert.alert('Database Error', 'Failed to create a new session.');
      }
    };

    return (
      <TouchableOpacity
        accessibilityRole="button"
        style={localStyles.addSessionButton}
        onPress={onAddSessionButtonPress}>
        <Image source={KirokuIcons.Plus} style={localStyles.addSessionImage} />
      </TouchableOpacity>
    );
  };

  /** Offset the "date" hook by a number of days.
   *
   * @param days Number of days to change the day by.
   */
  const changeDay = (days: number) => {
    if (date != null) {
      const newDate = changeDateBySomeDays(currentDate, days);
      setCurrentDate(newDate);
    }
  };

  if (!isOnline) {
    return <UserOffline />;
  }
  if (!date) {
    return <FullScreenLoadingIndicator />;
  }
  if (!user) {
    Navigation.navigate(ROUTES.LOGIN);
    return;
  }

  return (
    <ScreenWrapper testID={DayOverviewScreen.displayName}>
      <HeaderWithBackButton
        onBackButtonPress={Navigation.goBack}
        customRightButton={
          <MainHeaderButton
            buttonOn={editMode}
            textOn="Exit Edit Mode"
            textOff="Edit Mode"
            onPress={() => setEditMode(!editMode)}
          />
        }
      />
      <View style={localStyles.dayOverviewContainer}>
        <Text style={localStyles.menuDrinkingSessionInfoText}>
          {date ? formatDateToDay(currentDate) : 'Loading date...'}
        </Text>
        <FlatList
          data={dailyData}
          renderItem={renderDrinkingSession}
          keyExtractor={item => String(item.sessionId)} // Use start time as id
          ListEmptyComponent={noDrinkingSessionsComponent}
          ListFooterComponent={addSessionButton}
          ListFooterComponentStyle={localStyles.addSessionButtonContainer}
        />
      </View>
      <View style={localStyles.dayOverviewFooter}>
        <MenuIcon
          iconId="navigate-day-back"
          iconSource={KirokuIcons.ArrowBack}
          containerStyle={localStyles.footerArrowContainer}
          iconStyle={[localStyles.dayArrowIcon, localStyles.previousDayArrow]}
          onPress={() => {
            changeDay(-1);
          }}
        />
        <MenuIcon
          iconId="navigate-day-forward"
          iconSource={KirokuIcons.ArrowBack}
          containerStyle={localStyles.footerArrowContainer}
          iconStyle={[localStyles.dayArrowIcon, localStyles.nextDayArrow]}
          onPress={() => {
            changeDay(1);
          }}
        />
      </View>
    </ScreenWrapper>
  );
}

const screenWidth = Dimensions.get('window').width;

const localStyles = StyleSheet.create({
  menuDrinkingSessionContainer: {
    backgroundColor: 'white',
    height: 85,
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
    borderColor: '#ddd',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
  },
  backArrowContainer: {
    justifyContent: 'center',
    padding: 10,
  },
  backArrow: {
    width: 25,
    height: 25,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    width: 25,
    height: 25,
  },
  dayOverviewContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFF99',
  },
  menuDrinkingSessionButton: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 5,
  },
  menuDrinkingSessionText: {
    padding: 4,
    fontSize: 16,
    color: 'black',
  },
  menuDrinkingSessionInfoText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 5,
    color: 'black',
    alignSelf: 'center',
    alignContent: 'center',
    padding: 10,
  },
  dayOverviewFooter: {
    flexShrink: 1, // Only as large as necessary
    marginHorizontal: -1,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFF99',
    shadowColor: '#000',
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: -9,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderRadius: 2,
    marginVertical: 0,
    borderColor: '#ddd',
    elevation: 8, // for Android shadow
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addSessionButton: {
    borderRadius: 50,
    width: 70,
    height: 70,
    backgroundColor: 'green',
    alignItems: 'center',
    justifyContent: 'center', // Center the text within the button
  },
  addSessionImage: {
    width: 30,
    height: 30,
    tintColor: 'white',
    alignItems: 'center',
  },
  addSessionButtonContainer: {
    padding: 10,
    alignSelf: 'center',
  },
  footerArrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: screenWidth / 2,
    backgroundColor: 'white',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'grey',
    height: 50,
  },
  dayArrowIcon: {
    width: 25,
    height: 25,
    tintColor: 'black',
  },
  previousDayArrow: {
    alignSelf: 'flex-start',
    marginLeft: 15,
  },
  nextDayArrow: {
    transform: [{rotate: '180deg'}],
    alignSelf: 'flex-end',
    marginRight: 15,
  },
  ongoingSessionContainer: {
    width: 120,
    height: 40,
    borderRadius: 10,
    margin: 5,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: 'black',
  },
  ongoingSessionButton: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ongoingSessionText: {
    color: 'black',
    fontWeight: '500',
    fontSize: 20,
  },
});

DayOverviewScreen.displayName = 'Day Overview Screen';
export default DayOverviewScreen;
