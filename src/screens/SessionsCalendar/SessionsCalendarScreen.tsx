import React, {useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DateData} from 'react-native-calendars';
import SessionsCalendar from '@components/SessionsCalendar';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useFetchData from '@hooks/useFetchData';
import useDrinkingSessionsFetch from '@hooks/useDrinkingSessionsFetch';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {dateToDateData} from '@libs/DataHandling';
import Navigation from '@libs/Navigation/Navigation';
import type {SessionsCalendarNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import type {DrinkingSessionList, Preferences} from '@src/types/onyx';
import type {FetchDataKeys} from '@hooks/useFetchData/types';

type SessionsCalendarScreenProps = StackScreenProps<
  SessionsCalendarNavigatorParamList,
  typeof SCREENS.SESSIONS_CALENDAR.FULLSCREEN
>;

const FRIEND_FETCH_KEYS: FetchDataKeys = ['preferences'];

/**
 * Full-screen, scrollable sessions calendar.
 *
 * Pushed from a tap on the compact-calendar month header. Uses the same
 * `SessionsCalendar` component as the embedded view but in `fullscreen` mode,
 * which renders `CalendarList` with horizontal paging.
 *
 * Data source depends on whether the route's `userID` matches the auth user.
 * Both branches always call the same set of hooks — when not needed the hook
 * is invoked with an empty `userID`, which both hooks treat as a no-op.
 */
function SessionsCalendarScreen({route}: SessionsCalendarScreenProps) {
  const {auth} = useFirebase();
  const {userID} = route.params;
  const user = auth.currentUser;
  const isSelf = user?.uid === userID;
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();

  const ownData = useDatabaseData();
  const {data: friendFetchedData, isLoading: isFriendFetchLoading} =
    useFetchData(isSelf ? '' : userID, FRIEND_FETCH_KEYS);
  const {
    data: friendSessionData,
    isLoading: isFriendSessionsLoading,
    isFetchingOlderMonths: friendFetchingOlder,
  } = useDrinkingSessionsFetch(isSelf ? '' : userID);

  const drinkingSessionData: DrinkingSessionList | null | undefined = isSelf
    ? ownData.drinkingSessionData
    : friendSessionData;
  const preferences: Preferences | undefined = isSelf
    ? ownData.preferences
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

  return (
    <ScreenWrapper testID={SessionsCalendarScreen.displayName}>
      <HeaderWithBackButton
        title={translate('calendar.fullscreenTitle')}
        shouldShowBackButton={false}
        shouldShowCloseButton
        onCloseButtonPress={() => Navigation.goBack()}
      />
      {isFetchingOlderMonths && (
        <View style={styles.sessionsCalendarHeaderSpinner}>
          <ActivityIndicator size="small" color={theme.spinner} />
        </View>
      )}
      {isLoading || !preferences ? (
        <FullScreenLoadingIndicator />
      ) : (
        <View style={styles.flex1}>
          <SessionsCalendar
            userID={userID}
            visibleDate={visibleDate}
            onDateChange={setVisibleDate}
            drinkingSessionData={drinkingSessionData}
            preferences={preferences}
            isFetchingOlderMonths={isFetchingOlderMonths}
            mode="fullscreen"
          />
        </View>
      )}
    </ScreenWrapper>
  );
}

SessionsCalendarScreen.displayName = 'SessionsCalendarScreen';
export default SessionsCalendarScreen;
