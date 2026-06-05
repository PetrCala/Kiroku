import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import SessionsCalendar from '@components/SessionsCalendar';
import type {DateData} from 'react-native-calendars';
import {
  calculateThisMonthUnits,
  timestampToDate,
  dateToDateData,
  dateStringToDate,
} from '@libs/DataHandling';
import {useUserConnection} from '@context/global/UserConnectionContext';
import UserOffline from '@components/UserOfflineModal';
import {syncUserStatus} from '@userActions/User';
import {useFirebase} from '@context/global/FirebaseContext';
import ProfileImage from '@components/ProfileImage';
import {SupporterBadgeForUser} from '@components/SupporterBadge';
import CONST from '@src/CONST';
import type {DrinkingSessionArray} from '@src/types/onyx';
import ROUTES from '@src/ROUTES';
import Navigation from '@navigation/Navigation';
import type {StackScreenProps} from '@react-navigation/stack';
import {useFocusEffect} from '@react-navigation/native';
import type {BottomTabNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import type {StatData} from '@components/Items/StatOverview';
import StatOverview from '@components/Items/StatOverview';
import ScreenWrapper from '@components/ScreenWrapper';
import MessageBanner from '@components/Info/MessageBanner';
import useThemeStyles from '@hooks/useThemeStyles';
import getPlatform from '@libs/getPlatform';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as DS from '@userActions/DrinkingSession';
import * as App from '@userActions/App';
import * as Session from '@userActions/Session';
import Timing from '@userActions/Timing';
import ScrollView from '@components/ScrollView';
import useLocalize from '@hooks/useLocalize';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import Text from '@components/Text';
import BottomTabBar from '@libs/Navigation/AppNavigator/createCustomBottomTabNavigator/BottomTabBar';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import Button from '@components/Button';
import SessionsCalendarCompactSkeleton from '@components/SessionsCalendar/SessionsCalendarCompactSkeleton';
import {HomeHeaderSkeleton, StatOverviewSkeleton} from './HomeScreenSkeleton';

type HomeScreenProps = StackScreenProps<
  BottomTabNavigatorParamList,
  typeof SCREENS.HOME
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HomeScreen({route}: HomeScreenProps) {
  const styles = useThemeStyles();
  const {auth, storage} = useFirebase();
  const {translate} = useLocalize();
  const user = auth.currentUser;
  const {isOnline} = useUserConnection();
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const [ongoingSessionData] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const [lastViewedCalendarDate] = useOnyx(
    ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE,
  );
  const {isFetchingOlderMonths} = useDatabaseData();
  // `useCurrentUserData` returns {} (truthy) while loading; the readiness gates
  // and header below treat `undefined` as "not loaded", so map empty → undefined.
  const currentUserData = useCurrentUserData();
  const userData = isEmptyObject(currentUserData) ? undefined : currentUserData;
  const preferences = useCurrentUserPreferences();
  const drinkingSessionData = useCurrentUserDrinkingSessions();
  const [localVisibleDate, setLocalVisibleDate] = useState<DateData>(
    dateToDateData(new Date()),
  );
  const hasMarkedReadyRef = useRef(false);

  // The calendar's visible month: the last-viewed day from an enlarged calendar
  // / day-overview scroll when present, otherwise the locally-navigated month.
  // Deriving it (rather than syncing via an effect) means it's already correct
  // on the first render after the modal dismisses — home updates while still
  // hidden underneath, so the user never sees the month flip from today. The
  // NVP is reset on app launch, so a cold start shows today.
  const visibleDate = useMemo<DateData>(
    () =>
      lastViewedCalendarDate
        ? dateToDateData(dateStringToDate(lastViewedCalendarDate))
        : localVisibleDate,
    [lastViewedCalendarDate, localVisibleDate],
  );

  // Manual month navigation overrides the synced value.
  const onDateChange = useCallback((nextDate: DateData) => {
    setLocalVisibleDate(nextDate);
    App.clearLastViewedCalendarDate();
  }, []);

  // Derive stats synchronously from the visible month + drink unit mapping.
  // Narrowed to `drinksToUnits` so unrelated preference updates (e.g. picking
  // a color palette) don't recompute the stats.
  const drinksToUnits = preferences?.drinks_to_units;
  const {drinkingSessionsCount, unitsConsumed: baseUnitsConsumed} =
    useMemo(() => {
      if (!drinksToUnits || !drinkingSessionData) {
        return {drinkingSessionsCount: 0, unitsConsumed: 0};
      }
      const drinkingSessionArray: DrinkingSessionArray =
        Object.values(drinkingSessionData);
      const monthUnits = calculateThisMonthUnits(
        visibleDate,
        drinkingSessionArray,
        drinksToUnits,
      );
      const monthSessionCount = DSUtils.getSingleMonthDrinkingSessions(
        timestampToDate(visibleDate.timestamp),
        drinkingSessionArray,
        false,
      ).length;
      return {
        drinkingSessionsCount: monthSessionCount,
        unitsConsumed: monthUnits,
      };
    }, [drinkingSessionData, visibleDate, drinksToUnits]);

  // The live session's drinks live only in ONGOING_SESSION_DATA, not the cached
  // snapshot the base stats read from, so add them on top. Reusing the month
  // filter keeps it scoped to the visible month (0 for past months / no live
  // session). The session COUNT is left untouched — the cache already seeds the
  // ongoing session (with 0 units) at start, so it is already counted once.
  const liveExtraUnits = useMemo(() => {
    if (!drinksToUnits || !ongoingSessionData?.ongoing) {
      return 0;
    }
    return calculateThisMonthUnits(
      visibleDate,
      [ongoingSessionData],
      drinksToUnits,
    );
  }, [ongoingSessionData, visibleDate, drinksToUnits]);
  const unitsConsumed = baseUnitsConsumed + liveExtraUnits;

  const statsData: StatData = [
    {
      header: translate('profileScreen.drinkingSessions', {
        sessionsCount: drinkingSessionsCount,
      }),
      content: String(drinkingSessionsCount),
    },
    {
      header: translate('profileScreen.unitsConsumed', {
        unitCount: roundToTwoDecimalPlaces(unitsConsumed),
      }),
      content: String(roundToTwoDecimalPlaces(unitsConsumed)),
    },
  ];

  useEffect(() => {
    // Update the ongoing session local data
    const ongoingSessionId = DSUtils.getOngoingSessionId(drinkingSessionData);
    DS.syncLocalLiveSessionData(ongoingSessionId, drinkingSessionData);
  }, [drinkingSessionData]);

  useFocusEffect(
    React.useCallback(() => {
      // Presence heartbeat on home focus: the server recomputes user_status
      // from the caller's own sessions, so no client-supplied data is sent.
      if (!user || !userData || !preferences) {
        return;
      }

      syncUserStatus();
    }, [user, userData, preferences]),
  );

  // Fire the "home is ready" side effects exactly once, when all the initial
  // data has arrived. The screen renders skeletons in the meantime, so these
  // side effects no longer gate the visible UI.
  useEffect(() => {
    if (
      hasMarkedReadyRef.current ||
      !!loadingText ||
      !preferences ||
      !userData ||
      !user
    ) {
      return;
    }
    hasMarkedReadyRef.current = true;
    Session.setHasCheckedAutoLogin(true);
    Timing.end(CONST.TIMING.HOMEPAGE_INITIAL_RENDER);
  }, [loadingText, preferences, userData, user]);

  if (!user) {
    throw new Error(translate('common.error.userNull'));
  }

  if (!isOnline) {
    return <UserOffline />;
  }

  // Active operations (e.g. saving a session) still take a full-screen overlay
  // so they don't compete with the home UI for attention.
  if (loadingText) {
    return <FullScreenLoadingIndicator loadingText={loadingText} />;
  }

  // Render the shell + skeletons immediately. Real components swap in for
  // their skeletons as each piece of data resolves from Firebase. The
  // calendar renders even when the user has no sessions yet — empty days
  // are still a valid view of their history.
  const isPreferencesReady = !!preferences;
  const isUserDataReady = !!userData;
  const isSessionsReady = drinkingSessionData !== undefined;
  const showSkeletonContent = !isPreferencesReady || !isSessionsReady;

  const renderMainContent = () => {
    if (showSkeletonContent) {
      return (
        <>
          <StatOverviewSkeleton />
          <SessionsCalendarCompactSkeleton />
        </>
      );
    }
    return (
      <>
        <StatOverview statsData={statsData} />
        <SessionsCalendar
          userID={user.uid}
          visibleDate={visibleDate}
          onDateChange={onDateChange}
          drinkingSessionData={drinkingSessionData}
          preferences={preferences}
          isFetchingOlderMonths={isFetchingOlderMonths}
        />
      </>
    );
  };

  return (
    <ScreenWrapper
      testID={HomeScreen.displayName}
      includePaddingTop={false}
      includeSafeAreaPaddingBottom={getPlatform() !== CONST.PLATFORM.IOS}>
      {/* // TODO rewrite this into the HeaderWithBackButton component */}
      {isUserDataReady ? (
        <View style={[styles.headerBar, styles.borderBottom, styles.ph2]}>
          <Button
            style={[styles.flexRow, styles.bgTransparent]}
            onPress={() =>
              Navigation.navigate(ROUTES.PROFILE.getRoute(user.uid))
            }>
            <ProfileImage
              storage={storage}
              userID={user.uid}
              downloadPath={userData.profile.photo_url}
              style={styles.avatarMedium}
              // refreshTrigger={refreshCounter}
              refreshTrigger={0}
            />
            <Text style={[styles.headerText, styles.textLarge, styles.ml3]}>
              {userData?.profile?.display_name ?? ''}
            </Text>
            <View style={styles.ml1}>
              <SupporterBadgeForUser userID={user.uid} size="medium" />
            </View>
          </Button>
        </View>
      ) : (
        <HomeHeaderSkeleton />
      )}
      <ScrollView contentContainerStyle={styles.ph2}>
        {!!ongoingSessionData?.ongoing && (
          <MessageBanner
            danger
            text={translate('homeScreen.currentlyInSession')}
            onPress={() => DS.navigateToOngoingSessionScreen()}
          />
        )}
        {renderMainContent()}
      </ScrollView>
      <BottomTabBar />
    </ScreenWrapper>
  );
}

HomeScreen.displayName = 'Home Screen';
export default HomeScreen;
