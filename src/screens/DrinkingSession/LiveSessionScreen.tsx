import React, {useRef, useState, useEffect, useMemo} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BasicButton from '@components/Buttons/BasicButton';
import {useFirebase} from '@context/global/FirebaseContext';
import {
  discardLiveDrinkingSession,
  endLiveDrinkingSession,
  removeDrinkingSessionData,
  removePlaceholderSessionData,
  saveDrinkingSessionData,
  updateSessionDrinks,
} from '@database/drinkingSessions';
import {
  addDrinks,
  formatDateToDay,
  formatDateToTime,
  removeDrinks,
  sumAllUnits,
  sumDrinksOfSingleType,
  timestampToDate,
  timestampToDateString,
  unitsToColors,
} from '@libs/DataHandling';
import type {DrinkingSession, DrinksList, Drinks} from '@src/types/onyx';
import YesNoPopup from '@components/Popups/YesNoPopup';
import {useUserConnection} from '@context/global/UserConnectionContext';
import UserOffline from '@components/UserOffline';
import DrinkTypesView from '@components/DrinkTypesView';
import SessionDetailsSlider from '@components/SessionDetailsSlider';
import SuccessIndicator from '@components/SuccessIndicator';
import commonStyles from '@styles/commonStyles';
import FillerView from '@components/FillerView';
import CONST from '@src/CONST';
import MainHeaderButton from '@components/Header/MainHeaderButton';
import Navigation from '@navigation/Navigation';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import ROUTES from '@src/ROUTES';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {isEqual} from 'lodash';
import {readDataOnce} from '@database/baseFunctions';
import DBPATHS from '@database/DBPATHS';
import useAsyncQueue from '@hooks/useAsyncQueue';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import ScreenWrapper from '@components/ScreenWrapper';
import DrinkData from '@libs/DrinkData';
import useLocalize from '@hooks/useLocalize';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

type LiveSessionScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.LIVE
>;

function LiveSessionScreen({route}: LiveSessionScreenProps) {
  const {sessionId} = route.params;
  // Context, database, and authentification
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const {translate} = useLocalize();
  const {isOnline} = useUserConnection();
  const {preferences} = useDatabaseData();
  const [session, setSession] = useState<DrinkingSession | null>(null);
  const initialSession = useRef<DrinkingSession | null>(null);
  // Session details
  const [totalUnits, setTotalUnits] = useState<number>(0);
  const [availableUnits, setAvailableUnits] = useState<number>(0);
  const [sessionFinished, setSessionFinished] = useState<boolean>(false);
  // Time info
  const [dbSyncSuccessful, setDbSyncSuccessful] = useState(false);
  const sessionDate = timestampToDate(session?.start_time ?? Date.now());
  const sessionStartTime = formatDateToTime(sessionDate);
  const sessionColor = preferences
    ? unitsToColors(totalUnits, preferences.units_to_colors)
    : 'green';
  // Other
  const [monkeMode, setMonkeMode] = useState<boolean>(false);
  const [discardModalVisible, setDiscardModalVisible] =
    useState<boolean>(false);
  const [openingSession, setOpeningSession] = useState<boolean>(true);
  const [loadingText, setLoadingText] = useState<string>('');
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [isPlaceholderSession, setIsPlaceholderSession] =
    useState<boolean>(false);
  const sessionIsLive = session?.ongoing ? true : false;
  const deleteSessionWording = session?.ongoing
    ? // ? translate('common.discard')
      // : translate('common.delete');
      'Discard'
    : 'Delete';
  const scrollViewRef = useRef<ScrollView>(null); // To navigate the view

  const {isPending, enqueueUpdate} = useAsyncQueue(
    async (newSession: DrinkingSession) => syncWithDb(newSession),
  );

  const syncWithDb = async (newSessionData: DrinkingSession) => {
    if (!user || !session) {
      return;
    }
    try {
      setDbSyncSuccessful(false);
      await saveDrinkingSessionData(
        db,
        user.uid,
        newSessionData,
        sessionId,
        true, // Update live session status
      );
      setDbSyncSuccessful(true);
    } catch (error: any) {
      throw new Error(translate('LiveSessionScreen.error.save'));
    }
  };

  const hasSessionChanged = () => {
    return !isEqual(initialSession.current, session);
  };

  const handleMonkePlus = () => {
    if (!session) {
      return;
    }
    if (availableUnits > 0) {
      const drinksToAdd: Drinks = {other: 1};
      const newDrinks: DrinksList | undefined = addDrinks(
        session?.drinks,
        drinksToAdd,
      );
      setSession({...session, drinks: newDrinks});
    }
  };

  const handleMonkeMinus = () => {
    if (!session) {
      return;
    }
    if (sumDrinksOfSingleType(session.drinks, CONST.DRINKS.KEYS.OTHER) > 0) {
      const newDrinks: DrinksList | undefined = removeDrinks(
        session.drinks,
        'other',
        1,
      );
      setSession({...session, drinks: newDrinks});
    }
    // Here, as else, maybe send an alert that there are other types of
    // drinks logged
  };

  const handleBlackoutChange = (value: boolean) => {
    if (!session) {
      return;
    }
    setSession({...session, blackout: value});
  };

  const handleNoteChange = (value: string) => {
    if (!session) {
      return;
    }
    setSession({...session, note: value});
  };

  const setCurrentDrinks = (newDrinks: DrinksList | undefined) => {
    if (!session) {
      return;
    }
    setSession({...session, drinks: newDrinks});
  };

  // Function to wait for pending updates to finish
  const waitForNoPendingUpdate = async () => {
    while (isPending) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  /** Determine the screen to return to, and navigate to it */
  const navigateBackDynamically = (
    action: DeepValueOf<typeof CONST.NAVIGATION.SESSION_ACTION>,
  ) => {
    const previousScreenName = Navigation.getLastScreenName(true);

    const routesMap = {
      SAVE: () => ROUTES.DRINKING_SESSION_SUMMARY.getRoute(sessionId),
      DISCARD: () => ROUTES.HOME,
    };

    const navigateToOverview = () =>
      ROUTES.DAY_OVERVIEW.getRoute(
        timestampToDateString(session?.start_time || Date.now()),
      );

    // Decide the route based on the action or previous screen
    const route =
      previousScreenName === SCREENS.DAY_OVERVIEW.ROOT
        ? navigateToOverview
        : routesMap[action];

    Navigation.navigate(route());
  };

  // Update the hooks whenever drinks change
  useMemo(() => {
    if (!preferences) {
      return;
    }
    const newTotalUnits = sumAllUnits(
      session?.drinks,
      preferences.drinks_to_units,
    );
    const newAvailableUnits = CONST.MAX_ALLOWED_UNITS - newTotalUnits;
    setTotalUnits(newTotalUnits);
    setAvailableUnits(newAvailableUnits);
  }, [session?.drinks]);

  async function saveSession(db: any, userID: string) {
    if (!session || !user) {
      return;
    }
    if (totalUnits > CONST.MAX_ALLOWED_UNITS) {
      console.log(translate('LiveSessionScreen.error.save'));
      return null;
    }
    if (totalUnits > 0) {
      try {
        setLoadingText(translate('LiveSessionScreen.saving'));
        setSessionFinished(true); // No more db syncs
        const newSessionData: DrinkingSession = {
          ...session,
          end_time: sessionIsLive ? Date.now() : session.start_time,
        };
        delete newSessionData.ongoing;
        // Wait for any pending updates to resolve first
        while (isPending) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (sessionIsLive) {
          await endLiveDrinkingSession(db, userID, newSessionData, sessionId);
        } else {
          await saveDrinkingSessionData(
            db,
            userID,
            newSessionData,
            sessionId,
            false, // Do not update live status
          );
        }
        await removePlaceholderSessionData(db, userID);
      } catch (error: any) {
        Alert.alert(
          translate('LiveSessionScreen.error.saveTitle'),
          translate('LiveSessionScreen.error.save'),
        );
      } finally {
        // Reroute to session summary, do not allow user to return
        navigateBackDynamically(CONST.NAVIGATION.SESSION_ACTION.SAVE);
        setLoadingText('');
      }
    }
  }

  const handleDiscardSession = () => {
    if (isPending) {
      return null;
    }
    setDiscardModalVisible(true);
  };

  const handleConfirmDiscard = async () => {
    if (!user) {
      return;
    }
    try {
      setLoadingText(
        `${sessionIsLive ? 'Discarding' : 'Deleting'} this session...`,
      );
      const discardFunction = sessionIsLive
        ? discardLiveDrinkingSession
        : removeDrinkingSessionData;
      await waitForNoPendingUpdate();
      await discardFunction(db, user.uid, sessionId);
      await removePlaceholderSessionData(db, user.uid);
    } catch (error: any) {
      Alert.alert(
        'Session discard failed',
        'Could not discard the session: ' + error.message,
      );
    } finally {
      navigateBackDynamically(CONST.NAVIGATION.SESSION_ACTION.DISCARD);
      setDiscardModalVisible(false);
      setLoadingText('');
    }
  };

  /** If an update is pending, update immediately before navigating away
   */
  const handleBackPress = async () => {
    if (!user) {
      return;
    }
    if (!sessionIsLive && hasSessionChanged()) {
      setShowLeaveConfirmation(true); // Unsaved changes
      return;
    }
    if (sessionIsLive) {
      try {
        setLoadingText('Synchronizing data...');
        await waitForNoPendingUpdate();
        await updateSessionDrinks(db, user.uid, sessionId, session?.drinks);
      } catch (error: any) {
        Alert.alert('Database synchronization failed', error.message);
      } finally {
        setLoadingText('');
      }
    }
    await confirmGoBack();
  };

  const confirmGoBack = async () => {
    if (!user) {
      return;
    }
    try {
      if (isPlaceholderSession) {
        await removePlaceholderSessionData(db, user.uid);
      }
    } catch (error: any) {
      console.log('Could not remove placeholder session data', error.message); // Unimportant
    } finally {
      setShowLeaveConfirmation(false);
      Navigation.goBack();
    }
  };

  const openSession = async () => {
    if (!user) {
      return;
    }
    // Fetch the latest database data and use it to open the session
    setLoadingText('Opening your session...');
    let sessionToOpen: DrinkingSession | null = await readDataOnce(
      db,
      DBPATHS.USER_DRINKING_SESSIONS_USER_ID_SESSION_ID.getRoute(
        user.uid,
        sessionId,
      ),
    );
    if (!sessionToOpen) {
      // No drinking session with this ID => check for a placeholder session.
      const existingPlaceholderSession: DrinkingSession | null =
        await readDataOnce(
          db,
          DBPATHS.USER_SESSION_PLACEHOLDER_USER_ID.getRoute(user.uid),
        );
      if (!existingPlaceholderSession) {
        Alert.alert('Database Error', 'Failed to start a new session');
        Navigation.navigate(ROUTES.HOME);
        return;
      }
      sessionToOpen = existingPlaceholderSession;
      setIsPlaceholderSession(true);
    }
    setSession(sessionToOpen);
    initialSession.current = sessionToOpen;
    setOpeningSession(false);
    setLoadingText('');
  };

  // Prepare the session for the user upon component mount
  useEffect(() => {
    openSession();
  }, []);

  // Synchronize the session with database
  useEffect(() => {
    // Only schedule a database update if any hooks changed
    // Do not automatically save if the session is over, or
    // if the initial fetch has not finished
    if (
      !user ||
      !sessionIsLive ||
      !session ||
      sessionFinished ||
      openingSession
    ) {
      return;
    }
    enqueueUpdate({...session, ongoing: true});
  }, [session, openingSession]);

  // Make the system back press toggle the go back handler
  useEffect(() => {
    const backAction = () => {
      handleBackPress();
      return true; // Prevent the event from bubbling up and being handled by the default handler
    };

    BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', backAction);
    };
  }, [session]);

  if (!isOnline) {
    return <UserOffline />;
  }
  if (openingSession || loadingText) {
    return <FullScreenLoadingIndicator loadingText={loadingText} />;
  }
  if (!user) {
    Navigation.navigate(ROUTES.LOGIN);
    return;
  }
  if (!session) {
    Navigation.navigate(ROUTES.HOME); // If a session fails to load
    return;
  }
  if (!preferences) {
    return;
  }

  return (
    <ScreenWrapper testID={LiveSessionScreen.displayName}>
      <HeaderWithBackButton
        onBackButtonPress={handleBackPress}
        customRightButton={
          <MainHeaderButton
            buttonOn={monkeMode}
            textOn="Exit Monke Mode"
            textOff="Monke Mode"
            onPress={() => setMonkeMode(!monkeMode)}
          />
        }
      />
      <ScrollView
        style={styles.scrollView}
        ref={scrollViewRef}
        onScrollBeginDrag={Keyboard.dismiss}
        keyboardShouldPersistTaps="handled">
        <View style={styles.sessionInfoContainer}>
          <View style={styles.sessionTextContainer}>
            <Text style={styles.sessionInfoText}>
              {session?.ongoing
                ? `Session from ${sessionStartTime}`
                : `Session on ${formatDateToDay(sessionDate)}`}
            </Text>
          </View>
          {isPending && (
            <ActivityIndicator
              size="small"
              color="#0000ff"
              style={styles.isPendingIndicator}
            />
          )}
          <SuccessIndicator
            visible={dbSyncSuccessful}
            successStyle={[styles.successStyle, commonStyles.successIndicator]}
          />
        </View>
        <View style={styles.unitCountContainer}>
          <Text style={[styles.unitCountText, {color: sessionColor}]}>
            {totalUnits}
          </Text>
        </View>
        {monkeMode ? (
          <View style={styles.modifyUnitsContainer}>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.modifyUnitsButton, {backgroundColor: 'red'}]}
              onPress={() => handleMonkeMinus()}>
              <Text style={styles.modifyUnitsText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.modifyUnitsButton, {backgroundColor: 'green'}]}
              onPress={() => handleMonkePlus()}>
              <Text style={styles.modifyUnitsText}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.drinkTypesContainer}>
              <DrinkTypesView
                drinkData={DrinkData}
                currentDrinks={session.drinks}
                setCurrentDrinks={setCurrentDrinks}
                availableUnits={availableUnits}
              />
            </View>
            <SessionDetailsSlider
              scrollViewRef={scrollViewRef}
              isBlackout={session.blackout}
              onBlackoutChange={handleBlackoutChange}
              note={session.note}
              onNoteChange={handleNoteChange}
            />
          </>
        )}
        <FillerView />
      </ScrollView>
      <View style={styles.saveSessionDelimiter} />
      <View style={styles.saveSessionContainer}>
        <BasicButton
          text={`${deleteSessionWording} Session`}
          buttonStyle={[
            styles.saveSessionButton,
            isPending
              ? styles.disabledSaveSessionButton
              : styles.enabledSaveSessionButton,
          ]}
          textStyle={styles.saveSessionButtonText}
          onPress={handleDiscardSession}
        />
        <YesNoPopup
          visible={discardModalVisible}
          transparent={true}
          onRequestClose={() => setDiscardModalVisible(false)}
          message={`Do you really want to\n${deleteSessionWording.toLowerCase()} this session?`}
          onYes={handleConfirmDiscard}
        />
        <BasicButton
          text="Save Session"
          buttonStyle={[
            styles.saveSessionButton,
            isPending
              ? styles.disabledSaveSessionButton
              : styles.enabledSaveSessionButton,
          ]}
          textStyle={styles.saveSessionButtonText}
          onPress={() => saveSession(db, user.uid)}
        />
        <YesNoPopup
          visible={showLeaveConfirmation}
          transparent={true}
          onRequestClose={() => setShowLeaveConfirmation(false)}
          message="You have unsaved changes. Are you sure you want to go back?"
          onYes={() => confirmGoBack()} // No changes to the session object
        />
        {/* <AsyncResponsiveComponent
          trigger={isPending}
          asyncOperation={asyncOperation}
        /> */}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  backArrowContainer: {
    justifyContent: 'center',
    alignSelf: 'center',
    padding: 10,
  },
  backArrow: {
    width: 25,
    height: 25,
  },
  sessionInfoContainer: {
    backgroundColor: '#FFFF99',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sessionTextContainer: {
    alignItems: 'center',
  },
  sessionInfoText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
    color: 'black',
    alignSelf: 'center',
    alignContent: 'center',
    padding: 5,
  },
  isPendingIndicator: {
    width: 25,
    height: 25,
    margin: 10,
    position: 'absolute',
    right: 0,
  },
  successStyle: {
    position: 'absolute',
    right: 0,
  },
  unitCountContainer: {
    backgroundColor: '#FFFF99',
  },
  unitCountText: {
    fontSize: 90,
    fontWeight: 'bold',
    // marginTop: 5,
    marginBottom: 10,
    alignSelf: 'center',
    alignContent: 'center',
    padding: 2,
    textShadowColor: '#000',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 8,
    elevation: 5,
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFF99',
  },
  drinkTypesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  drinksInputContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  drinksInputButton: {
    width: '40%',
    alignItems: 'center',
  },
  drinksInputText: {
    fontSize: 90,
    fontWeight: 'bold',
    // marginTop: 5,
    marginBottom: 10,
    alignSelf: 'center',
    alignContent: 'center',
    padding: 2,
    textShadowColor: 'black',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 9,
  },
  modifyUnitsContainer: {
    height: 400,
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexDirection: 'row',
    padding: 10,
  },
  modifyUnitsButton: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
  },
  modifyUnitsText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  sessionDetailsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
  },
  saveSessionDelimiter: {
    width: 0,
    // height: 5,
    // width: '100%',
    // backgroundColor: 'white',
    // borderTopWidth: 1,
    // borderColor: '#000',
  },
  saveSessionContainer: {
    height: '8%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#FFFF99',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    borderTopWidth: 1,
    borderColor: '#ddd',
    elevation: 10, // for Android shadow
  },
  saveSessionButton: {
    width: '50%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginBottom: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  enabledSaveSessionButton: {
    backgroundColor: '#fcf50f',
  },
  disabledSaveSessionButton: {
    // backgroundColor: '#fffb82', // No longer used
    backgroundColor: '#fcf50f',
  },
  saveSessionButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

LiveSessionScreen.displayName = 'Live Session Screen';
export default LiveSessionScreen;
