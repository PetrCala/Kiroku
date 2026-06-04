import React, {useCallback, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DateData} from 'react-native-calendars';
import SessionsCalendar from '@components/SessionsCalendar';
import SessionsCalendarSkeleton from '@components/SessionsCalendar/SessionsCalendarSkeleton';
import DayDrillDownSheet from '@components/SessionsCalendar/DayDrillDownSheet';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useFetchData from '@hooks/useFetchData';
import useDrinkingSessionsFetch from '@hooks/useDrinkingSessionsFetch';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import useReadyAfterScreenTransition from '@hooks/useReadyAfterScreenTransition';
import useThemeStyles from '@hooks/useThemeStyles';
import {dateToDateData} from '@libs/DataHandling';
import Navigation from '@libs/Navigation/Navigation';
import type {SessionsCalendarNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import type {DrinkingSessionList, Preferences} from '@src/types/onyx';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type {FetchDataKeys} from '@hooks/useFetchData/types';

type SessionsCalendarScreenProps = StackScreenProps<
  SessionsCalendarNavigatorParamList,
  typeof SCREENS.SESSIONS_CALENDAR.FULLSCREEN
>;

const FRIEND_FETCH_KEYS: FetchDataKeys = ['preferences'];

const internalStyles = StyleSheet.create({
  // Render the calendar mounted but invisible so FlashList can lay out and
  // apply the initial scroll. Switched to visible by `onInitialScrollReady`.
  hidden: {opacity: 0},
});

/**
 * Full-screen, scrollable sessions calendar.
 *
 * Pushed from a tap on the compact-calendar month header. Uses the same
 * `SessionsCalendar` component as the embedded view but in `fullscreen`
 * mode, which renders the continuous week-list view.
 *
 * Data source depends on whether the route's `userID` matches the auth
 * user. Both branches always call the same set of hooks — when not needed
 * the hook is invoked with an empty `userID`, which both hooks treat as a
 * no-op.
 */
function SessionsCalendarScreen({route}: SessionsCalendarScreenProps) {
  const {auth} = useFirebase();
  const {userID, monthYear} = route.params;
  const user = auth.currentUser;
  const isSelf = user?.uid === userID;
  const {translate} = useLocalize();
  const styles = useThemeStyles();

  const ownData = useDatabaseData();
  const ownPreferences = useCurrentUserPreferences();
  const currentUserSessions = useCurrentUserDrinkingSessions();
  const {data: friendFetchedData, isLoading: isFriendFetchLoading} =
    useFetchData(isSelf ? '' : userID, FRIEND_FETCH_KEYS);
  const {
    data: friendSessionData,
    isLoading: isFriendSessionsLoading,
    isFetchingOlderMonths: friendFetchingOlder,
  } = useDrinkingSessionsFetch(isSelf ? '' : userID);

  const drinkingSessionData: DrinkingSessionList | null | undefined = isSelf
    ? currentUserSessions
    : friendSessionData;
  const preferences: Preferences | undefined = isSelf
    ? ownPreferences
    : friendFetchedData?.preferences;
  const isFetchingOlderMonths = isSelf
    ? ownData.isFetchingOlderMonths
    : friendFetchingOlder;
  const isLoading = isSelf
    ? !preferences || drinkingSessionData === undefined
    : isFriendFetchLoading || isFriendSessionsLoading;

  const [visibleDate, setVisibleDate] = useState<DateData>(() =>
    dateToDateData(new Date()),
  );

  // The day whose drill-down sheet is open, or null when closed. Tapping a day
  // in the infinite calendar opens the sheet; for self it's editable (tap a
  // session → summary, edit button → edit), for friends it's read-only. Kept
  // mounted across the edit round-trip so it reopens on back with live data.
  const [drillDownDate, setDrillDownDate] = useState<DateString | null>(null);

  // Hold the calendar invisible until the WeekListView has applied its
  // initial scroll, so the user never sees a "latest at bottom → target"
  // jump on open. With no `monthYear` (e.g. deep-link), we never wait.
  const [isScrollReady, setIsScrollReady] = useState<boolean>(!monthYear);
  const onInitialScrollReady = useCallback(() => setIsScrollReady(true), []);

  // Defer the (heavy) fullscreen calendar mount until after the navigation
  // slide. `useLazyMarkedDates` + the week-list build run synchronously on
  // first render, which otherwise blocks the slide-in from the compact
  // calendar's header tap. Render only the skeleton first.
  const {isReady: didScreenTransitionEnd, onEntryTransitionEnd} =
    useReadyAfterScreenTransition();

  const showLoader =
    !didScreenTransitionEnd || isLoading || !preferences || !isScrollReady;

  return (
    <ScreenWrapper
      testID={SessionsCalendarScreen.displayName}
      onEntryTransitionEnd={onEntryTransitionEnd}>
      <HeaderWithBackButton
        title={translate('calendar.fullscreenTitle')}
        shouldShowBackButton={false}
        shouldShowCloseButton
        onCloseButtonPress={() => Navigation.goBack()}
      />
      <View style={styles.flex1}>
        {didScreenTransitionEnd && !isLoading && preferences && (
          <View
            style={[
              styles.flex1,
              styles.ph2,
              !isScrollReady && internalStyles.hidden,
            ]}>
            <SessionsCalendar
              userID={userID}
              visibleDate={visibleDate}
              onDateChange={setVisibleDate}
              drinkingSessionData={drinkingSessionData}
              preferences={preferences}
              isFetchingOlderMonths={isFetchingOlderMonths}
              mode="fullscreen"
              initialMonthYear={monthYear}
              onInitialScrollReady={onInitialScrollReady}
              onDayDrillDown={setDrillDownDate}
            />
          </View>
        )}
        {showLoader && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <SessionsCalendarSkeleton />
          </View>
        )}
      </View>
      {preferences && (
        <DayDrillDownSheet
          isVisible={!!drillDownDate}
          onClose={() => setDrillDownDate(null)}
          date={drillDownDate}
          drinkingSessionData={drinkingSessionData}
          preferences={preferences}
          canEdit={isSelf}
        />
      )}
    </ScreenWrapper>
  );
}

SessionsCalendarScreen.displayName = 'SessionsCalendarScreen';
export default SessionsCalendarScreen;
