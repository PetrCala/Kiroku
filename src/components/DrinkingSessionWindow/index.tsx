import React, {useState, useEffect, useMemo, useRef} from 'react';
import {BackHandler, View} from 'react-native';
import type {Database} from 'firebase/database';
import {useFirebase} from '@context/global/FirebaseContext';
import * as DS from '@userActions/DrinkingSession';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import Text from '@components/Text';
import type {DrinkingSession} from '@src/types/onyx';
import DrinkTypesView from '@components/DrinkTypesView';
import SessionDetailsWindow from '@components/SessionDetailsWindow';
import FillerView from '@components/FillerView';
import CONST from '@src/CONST';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useLocalize from '@hooks/useLocalize';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useThemeStyles from '@hooks/useThemeStyles';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as App from '@userActions/App';
import {convertUnitsToColors} from '@libs/DataHandling';
import ScrollView from '@components/ScrollView';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import SuccessIndicator from '@components/SuccessIndicator';
import Log from '@libs/Log';
import DateUtils from '@libs/DateUtils';
import {isEqual} from 'lodash';
import type {CalendarColors} from '@components/SessionsCalendar/types';
import type {User} from 'firebase/auth';
import {useFocusEffect} from '@react-navigation/native';
import ERRORS from '@src/ERRORS';
import type DrinkingSessionWindowProps from './types';

function DrinkingSessionWindow({
  onNavigateBack,
  sessionId,
  session,
  onyxKey,
  type,
  shouldShowSyncPendingIndicator = false,
  shouldShowSyncSuccessIndicator = false,
}: DrinkingSessionWindowProps) {
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {preferences} = useDatabaseData();
  const sessionRef = useRef<DrinkingSession | undefined>(session);
  // Session details
  const [totalUnits, setTotalUnits] = useState<number>(0);
  const [sessionColor, setSessionColor] = useState<string>('green');
  // const [dbSyncSuccessful, setDbSyncSuccessful] = useState(false);
  const [discardModalVisible, setDiscardModalVisible] =
    useState<boolean>(false);
  const [shouldShowLeaveConfirmation, setShouldShowLeaveConfirmation] =
    useState(false);
  const sessionIsLive = session?.ongoing;
  const deleteSessionWording = session.ongoing
    ? translate('common.discard')
    : translate('common.delete');

  const hasSessionChanged = () => {
    return !isEqual(sessionRef.current, session);
  };

  const saveSession = (database: Database, usr: User | null) => {
    (async () => {
      if (!session || !usr) {
        return;
      }
      if (totalUnits > CONST.MAX_ALLOWED_UNITS) {
        Log.warn('DrinkingSessionWindow - saveSession - Max units exceeded');
        return null;
      }
      if (totalUnits <= 0) {
        // TODO inform the user why the they can not save their session - 0 units
        return;
      }

      await App.setLoadingText(translate('liveSessionScreen.saving'));
      const newSessionData: DrinkingSession = {
        ...session,
        end_time: session?.ongoing ? Date.now() : session.end_time,
      };
      delete newSessionData.ongoing;
      delete newSessionData.id;

      try {
        await DS.saveDrinkingSessionData(
          database,
          usr.uid,
          newSessionData,
          sessionId,
          onyxKey,
          !!sessionIsLive, // Update status if the session is live
        );
        // Reroute to session summary, do not allow user to return
        onNavigateBack(CONST.NAVIGATION.SESSION_ACTION.SAVE);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.SESSION.SAVE_FAILED, error);
      } finally {
        await App.setLoadingText(null);
      }
    })();
  };

  const handleDiscardSession = () => {
    setDiscardModalVisible(true);
  };

  const handleConfirmDiscard = () => {
    (async () => {
      if (!user) {
        return;
      }
      try {
        setDiscardModalVisible(false);
        await App.setLoadingText(
          translate('liveSessionScreen.discardingSession', {
            discardWord: sessionIsLive ? 'Discarding' : 'Deleting',
          }),
        );
        await DS.removeDrinkingSessionData(
          db,
          user.uid,
          sessionId,
          onyxKey,
          !!sessionIsLive,
        );
        onNavigateBack(CONST.NAVIGATION.SESSION_ACTION.DISCARD);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.SESSION.DISCARD_FAILED, error);
      } finally {
        await App.setLoadingText(null);
      }
    })();
  };

  const confirmGoBack = () => {
    setShouldShowLeaveConfirmation(false);
    onNavigateBack(CONST.NAVIGATION.SESSION_ACTION.BACK);
  };

  /** If an update is pending, update immediately before navigating away
   */
  const handleBackPress = () => {
    if (!sessionIsLive && hasSessionChanged()) {
      setShouldShowLeaveConfirmation(true); // Unsaved changes
      return;
    }
    confirmGoBack();
  };

  // Update the hooks whenever drinks change
  useMemo(() => {
    if (!preferences) {
      return;
    }
    const newTotalUnits = DSUtils.calculateTotalUnits(
      session?.drinks,
      preferences.drinks_to_units,
      true,
    );
    const newSessionColor = convertUnitsToColors(
      totalUnits,
      preferences.units_to_colors,
    );
    setTotalUnits(newTotalUnits);
    setSessionColor(newSessionColor);
  }, [session?.drinks, preferences, totalUnits]);

  // Make the system back press toggle the go back handler
  useEffect(() => {
    const backAction = () => {
      handleBackPress();
      return true; // Prevent the event from bubbling up and being handled by the default handler
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(() => {
    App.setLoadingText(null);
  });

  return (
    <>
      <HeaderWithBackButton onBackButtonPress={handleBackPress} />
      {shouldShowSyncPendingIndicator && (
        <FlexibleLoadingIndicator
          size="small"
          style={styles.successIndicator}
        />
      )}
      <SuccessIndicator visible={shouldShowSyncSuccessIndicator} />
      <ScrollView contentContainerStyle={[styles.w100]}>
        <View style={styles.pt2}>
          <View style={styles.alignItemsCenter}>
            <Text style={styles.textHeadlineH2}>
              {session?.ongoing
                ? `${translate('liveSessionScreen.sessionFrom')} ${DateUtils.getLocalizedTime(session.start_time, session.timezone)}`
                : `${translate('liveSessionScreen.sessionOn')} ${DateUtils.getLocalizedDay(session.start_time, session.timezone)}`}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.pb2,
            styles.alignItemsCenter,
            styles.justifyContentCenter,
          ]}>
          <Text
            style={[
              styles.sessionUnitCountText(sessionColor as CalendarColors),
              styles.shadowStrong,
            ]}>
            {totalUnits}
          </Text>
        </View>
        <DrinkTypesView session={session} />
        <SessionDetailsWindow
          sessionId={sessionId}
          session={session}
          onBlackoutChange={(value: boolean) =>
            DS.updateBlackout(session, value)
          }
          shouldAllowDateChange={type !== CONST.SESSION.TYPES.LIVE}
          shouldAllowTimezoneChange={
            !session?.ongoing
            // session.type !== CONST.SESSION.TYPES.LIVE // Enable this down the line
          }
        />
        <FillerView />
      </ScrollView>
      <View style={[styles.bottomTabBarContainer, styles.gap2]}>
        <Button
          large
          text={translate('liveSessionScreen.discardSession', {
            discardWord: deleteSessionWording,
          })}
          style={styles.buttonLarge}
          onPress={handleDiscardSession}
        />
        <Button
          success
          large
          text={translate('liveSessionScreen.saveSession')}
          style={styles.buttonLargeSuccess}
          onPress={() => saveSession(db, user)}
        />
      </View>
      <ConfirmModal
        danger
        title={translate('common.warning')}
        onConfirm={handleConfirmDiscard}
        onCancel={() => setDiscardModalVisible(false)}
        isVisible={discardModalVisible}
        prompt={translate(
          'liveSessionScreen.discardSessionWarning',
          deleteSessionWording.toLowerCase(),
        )}
        confirmText={translate('common.yes')}
        cancelText={translate('common.no')}
        shouldDisableConfirmButtonWhenOffline
        shouldShowCancelButton
      />
      <ConfirmModal
        title={translate('common.warning')}
        onConfirm={() => confirmGoBack()} // No changes to the session object
        onCancel={() => setShouldShowLeaveConfirmation(false)}
        isVisible={shouldShowLeaveConfirmation}
        prompt={translate('liveSessionScreen.unsavedChangesWarning')}
        confirmText={translate('common.yes')}
        cancelText={translate('common.no')}
        shouldShowCancelButton
      />
    </>
  );
}

export default DrinkingSessionWindow;
