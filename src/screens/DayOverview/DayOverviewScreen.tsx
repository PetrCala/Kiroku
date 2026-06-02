import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import UserOffline from '@components/UserOfflineModal';
import {useUserConnection} from '@context/global/UserConnectionContext';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DayOverviewNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import Navigation from '@libs/Navigation/Navigation';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import {dateStringToDate, dateToDateData} from '@libs/DataHandling';
import * as App from '@userActions/App';
import * as DS from '@userActions/DrinkingSession';
import * as ErrorUtils from '@libs/ErrorUtils';
import ERRORS from '@src/ERRORS';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import SessionsCalendar from '@components/SessionsCalendar';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';

type DayOverviewScreenProps = StackScreenProps<
  DayOverviewNavigatorParamList,
  typeof SCREENS.DAY_OVERVIEW.ROOT
>;

const internalStyles = StyleSheet.create({
  // Mounted-but-invisible until the list applies its initial scroll, so the
  // user never sees a jump from "latest at top" to the focused day.
  hidden: {opacity: 0},
});

function noop() {}

function DayOverviewScreen({route}: DayOverviewScreenProps) {
  const {date} = route.params;
  const {isOnline} = useUserConnection();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const {drinkingSessionData, preferences, userData, isFetchingOlderMonths} =
    useDatabaseData();

  // Hold the list invisible until it has scrolled to the focused day. With no
  // `date` (shouldn't happen via the calendar) we never wait.
  const [isScrollReady, setIsScrollReady] = useState<boolean>(!date);
  const onInitialScrollReady = useCallback(() => setIsScrollReady(true), []);

  // dayList mode ignores `visibleDate`/`onDateChange`, but the shared
  // `SessionsCalendar` props require them.
  const placeholderVisibleDate = useMemo(() => dateToDateData(new Date()), []);

  const selectedTimezone = userData?.timezone?.selected;
  const onAddSessionForDay = useCallback(
    (day: DateString) => {
      (async () => {
        try {
          await App.setLoadingText(translate('liveSessionScreen.loading'));
          const newSession = await DS.getNewSessionToEdit(
            db,
            auth.currentUser,
            dateStringToDate(day),
            selectedTimezone,
          );
          DS.navigateToEditSessionScreen(newSession?.id);
        } catch (error) {
          ErrorUtils.raiseAppError(ERRORS.DATABASE.USER_CREATION_FAILED, error);
        } finally {
          await App.setLoadingText(null);
        }
      })();
    },
    [db, auth, translate, selectedTimezone],
  );

  if (!isOnline) {
    return <UserOffline />;
  }
  if (!date || !!loadingText) {
    return <FullScreenLoadingIndicator loadingText={loadingText} />;
  }

  const isReady = !!user && !!preferences && drinkingSessionData !== undefined;

  return (
    <ScreenWrapper testID={DayOverviewScreen.displayName}>
      <HeaderWithBackButton
        title={translate('calendar.fullscreenTitle')}
        onBackButtonPress={Navigation.goBack}
      />
      {isReady && (
        <View
          style={[
            styles.flex1,
            styles.ph2,
            !isScrollReady && internalStyles.hidden,
          ]}>
          <SessionsCalendar
            userID={user.uid}
            visibleDate={placeholderVisibleDate}
            onDateChange={noop}
            drinkingSessionData={drinkingSessionData}
            preferences={preferences}
            isFetchingOlderMonths={isFetchingOlderMonths}
            mode="dayList"
            initialDay={date}
            onAddSessionForDay={onAddSessionForDay}
            onInitialScrollReady={onInitialScrollReady}
          />
        </View>
      )}
      {(!isReady || !isScrollReady) && <FullScreenLoadingIndicator />}
    </ScreenWrapper>
  );
}

DayOverviewScreen.displayName = 'Day Overview Screen';
export default DayOverviewScreen;
