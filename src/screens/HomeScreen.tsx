import React, {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import SessionsCalendar from '@components/SessionsCalendar';
import type {DateData} from 'react-native-calendars';
import {dateToDateData} from '@libs/DataHandling';
import {useUserConnection} from '@context/global/UserConnectionContext';
import UserOffline from '@components/UserOfflineModal';
import {synchronizeUserStatus} from '@userActions/User';
import {useFirebase} from '@context/global/FirebaseContext';
import ProfileImage from '@components/ProfileImage';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import Navigation from '@navigation/Navigation';
import type {StackScreenProps} from '@react-navigation/stack';
import {useFocusEffect} from '@react-navigation/native';
import type {BottomTabNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import type {StatData} from '@components/Items/StatOverview';
import StatOverview from '@components/Items/StatOverview';
import ThisWeekCard from '@components/Home/ThisWeekCard';
import useHomeMonthStats from '@components/Home/useHomeMonthStats';
import useHomeWeekStats from '@components/Home/useHomeWeekStats';
import ScreenWrapper from '@components/ScreenWrapper';
import MessageBanner from '@components/Info/MessageBanner';
import useThemeStyles from '@hooks/useThemeStyles';
import getPlatform from '@libs/getPlatform';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as DS from '@userActions/DrinkingSession';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as Session from '@userActions/Session';
import Timing from '@userActions/Timing';
import ScrollView from '@components/ScrollView';
import useLocalize from '@hooks/useLocalize';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import Text from '@components/Text';
import BottomTabBar from '@libs/Navigation/AppNavigator/createCustomBottomTabNavigator/BottomTabBar';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import ERRORS from '@src/ERRORS';
import Button from '@components/Button';
import {
  HomeHeaderSkeleton,
  SessionsCalendarSkeleton,
  StatOverviewSkeleton,
} from './HomeScreenSkeleton';

type HomeScreenProps = StackScreenProps<
  BottomTabNavigatorParamList,
  typeof SCREENS.HOME
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HomeScreen({route}: HomeScreenProps) {
  const styles = useThemeStyles();
  const {auth, db, storage} = useFirebase();
  const {translate} = useLocalize();
  const user = auth.currentUser;
  const {isOnline} = useUserConnection();
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const [ongoingSessionData] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const {drinkingSessionData, preferences, userData, isFetchingOlderMonths} =
    useDatabaseData();
  const [visibleDate, setVisibleDate] = useState<DateData>(
    dateToDateData(new Date()),
  );
  const hasMarkedReadyRef = useRef(false);

  const {drinkingSessionsCount, unitsConsumed, alcoholFreeDays} =
    useHomeMonthStats(visibleDate, drinkingSessionData, preferences);
  const weekStats = useHomeWeekStats(drinkingSessionData, preferences);

  const statsData: StatData = [
    {
      header: translate('homeScreen.stats.alcoholFreeDays'),
      content: String(alcoholFreeDays),
      tone: 'celebratory',
    },
    {
      header: translate('homeScreen.stats.sessionsLogged'),
      content: String(drinkingSessionsCount),
    },
    {
      header: translate('homeScreen.stats.unitsConsumed'),
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
      // Update user status on home screen focus
      if (!user || !userData || !preferences) {
        return;
      }

      try {
        synchronizeUserStatus(db, user.uid, drinkingSessionData);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.USER.STATUS_UPDATE_FAILED, error);
      }
    }, [db, user, userData, preferences, drinkingSessionData]),
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
          <SessionsCalendarSkeleton />
        </>
      );
    }
    return (
      <>
        <SessionsCalendar
          userID={user.uid}
          visibleDate={visibleDate}
          onDateChange={setVisibleDate}
          drinkingSessionData={drinkingSessionData}
          preferences={preferences}
          isFetchingOlderMonths={isFetchingOlderMonths}
        />
        <StatOverview statsData={statsData} />
        <ThisWeekCard
          days={weekStats.days}
          summary={weekStats.summary}
          preferences={preferences}
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
