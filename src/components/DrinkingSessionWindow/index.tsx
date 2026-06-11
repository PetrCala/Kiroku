import React, {useState, useEffect, useMemo, useRef} from 'react';
import {BackHandler, View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import * as DS from '@userActions/DrinkingSession';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import Text from '@components/Text';
import type {DrinkingSession} from '@src/types/onyx';
import DrinkTypesView from '@components/DrinkTypesView';
import SessionDetailsWindow from '@components/SessionDetailsWindow';
import FillerView from '@components/FillerView';
import getPlatform from '@libs/getPlatform';
import CONST from '@src/CONST';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useThemeStyles from '@hooks/useThemeStyles';
import BottomActionBar from '@components/BottomActionBar';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as App from '@userActions/App';
import {convertUnitsToColors} from '@libs/DataHandling';
import {resolvePalette} from '@libs/SessionColorPalettes';
import ScrollView from '@components/ScrollView';
import Log from '@libs/Log';
import DateUtils from '@libs/DateUtils';
import isEqual from 'lodash/isEqual';
import type {User} from 'firebase/auth';
import ERRORS from '@src/ERRORS';
import type DrinkingSessionWindowProps from './types';

function DrinkingSessionWindow({
  onNavigateBack,
  sessionId,
  session,
  onyxKey,
  type,
}: DrinkingSessionWindowProps) {
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const preferences = useCurrentUserPreferences();
  const sessionRef = useRef<DrinkingSession | undefined>(session);
  // Session details
  const [totalUnits, setTotalUnits] = useState<number>(0);
  const [sessionColor, setSessionColor] = useState<string>(
    () => resolvePalette(preferences?.session_color_palette).green,
  );
  // const [dbSyncSuccessful, setDbSyncSuccessful] = useState(false);
  const [discardModalVisible, setDiscardModalVisible] =
    useState<boolean>(false);
  const [shouldShowLeaveConfirmation, setShouldShowLeaveConfirmation] =
    useState(false);
  const sessionIsLive = session?.ongoing;
  const deleteSessionWording = session.ongoing
    ? translate('common.discard')
    : translate('common.delete');

  const hasSessionChanged = () => !isEqual(sessionRef.current, session);

  const isSaveDisabled = totalUnits <= 0;

  const saveSession = (usr: User | null) => {
    (async () => {
      if (!session || !usr) {
        return;
      }
      if (totalUnits > CONST.MAX_ALLOWED_UNITS) {
        Log.warn('DrinkingSessionWindow - saveSession - Max units exceeded');
        return null;
      }
      if (isSaveDisabled) {
        return;
      }

      await App.setLoadingText(translate('liveSessionScreen.saving'));
      const newSessionData: DrinkingSession = {
        ...session,
        end_time: session?.ongoing ? Date.now() : session.end_time,
        // A saved session is never ongoing. Set the flag explicitly rather than
        // `delete`-ing it: cachedDrinkingSessions writes are merges, and a merge
        // can't clear a key by omission — an omitted `ongoing` leaves a stale
        // `ongoing: true` in the cache, which re-triggers the "in a session"
        // banner now that screens read sessions from the cache.
        ongoing: false,
      };
      delete newSessionData.id;

      try {
        await DS.saveDrinkingSessionData(
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
      preferences.session_color_palette,
    );
    setTotalUnits(newTotalUnits);
    setSessionColor(newSessionColor);
  }, [session?.drinks, preferences, totalUnits]);

  // Make the system back press toggle the go back handler. BackHandler is a
  // native-only API; on web it warns and no-ops, so skip it (web uses the
  // browser back button / Escape instead).
  useEffect(() => {
    if (getPlatform() === CONST.PLATFORM.WEB) {
      return;
    }
    const backAction = () => {
      handleBackPress();
      return true; // Prevent the event from bubbling up and being handled by the default handler
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <HeaderWithBackButton onBackButtonPress={handleBackPress} />
      <ScrollView contentContainerStyle={[styles.w100]}>
        <View style={styles.pt2}>
          <View style={styles.alignItemsCenter}>
            <Text style={styles.textHeadlineH2}>
              {session?.ongoing
                ? `${translate('liveSessionScreen.sessionFrom')} ${DateUtils.getLocalizedTime(session.start_time, session.timezone)}`
                : `${translate('liveSessionScreen.sessionOn')} ${DateUtils.getLocalizedDay(session.start_time, session.timezone, CONST.DATE.MONTH_DAY_YEAR_ABBR_FORMAT)}`}
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
              styles.sessionUnitCountText(sessionColor),
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
      <BottomActionBar containerStyle={styles.gap2}>
        {/* Each button is wrapped in a flex:1 view so the pair splits the row
            evenly; the wrapper (not the button) carries the flex, so the
            buttons keep their natural height instead of stretching vertically. */}
        <View style={styles.flex1}>
          <Button
            large
            text={translate('liveSessionScreen.discardSession', {
              discardWord: deleteSessionWording,
            })}
            style={styles.buttonLarge}
            onPress={handleDiscardSession}
          />
        </View>
        <View style={styles.flex1}>
          <Button
            success
            large
            isDisabled={isSaveDisabled}
            text={translate('liveSessionScreen.saveSession')}
            style={styles.buttonLargeSuccess}
            onPress={() => saveSession(user)}
          />
        </View>
      </BottomActionBar>
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
