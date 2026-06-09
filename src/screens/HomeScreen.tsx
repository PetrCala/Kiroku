import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import SessionsCalendar from '@components/SessionsCalendar';
import type {DateData} from 'react-native-calendars';
import {dateToDateData, dateStringToDate} from '@libs/DataHandling';
import OfflineIndicator from '@components/OfflineIndicator';
import {syncUserStatus} from '@userActions/User';
import {useFirebase} from '@context/global/FirebaseContext';
import ProfileImage from '@components/ProfileImage';
import {SupporterBadgeForUser} from '@components/SupporterBadge';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import Navigation from '@navigation/Navigation';
import type {StackScreenProps} from '@react-navigation/stack';
import {useFocusEffect} from '@react-navigation/native';
import type {BottomTabNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import MonthlyOverviewCard, {
  MonthlyOverviewCardSkeleton,
} from '@components/Items/MonthlyOverviewCard';
import ScreenWrapper from '@components/ScreenWrapper';
import HomeBanner, {HomeBannerSkeleton} from '@components/Info/HomeBanner';
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
import useHomeStats from '@hooks/useHomeStats';
import useLastSession from '@hooks/useLastSession';
import Text from '@components/Text';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import useTheme from '@hooks/useTheme';
import StartSessionButtonAndPopover from '@components/StartSessionButtonAndPopover';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import Button from '@components/Button';
import SessionsCalendarCompactSkeleton from '@components/SessionsCalendar/SessionsCalendarCompactSkeleton';
import NoSessionsInfo from '@components/NoSessionsInfo';
import useNetwork from '@hooks/useNetwork';
import useBottomTabBarHeight from '@hooks/useBottomTabBarHeight';
import HomeHeaderSkeleton from './HomeScreenSkeleton';
import getHomeContentState from './getHomeContentState';

type HomeScreenProps = StackScreenProps<
  BottomTabNavigatorParamList,
  typeof SCREENS.HOME
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HomeScreen({route}: HomeScreenProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  // Inset for the native tab bar, which overlays the scene: scroll content and
  // the FAB both clear it by this much (plus a small margin).
  const bottomTabBarHeight = useBottomTabBarHeight();
  const user = auth.currentUser;
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const [ongoingSessionData] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const [lastViewedCalendarDate] = useOnyx(
    ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE,
  );
  // `useCurrentUserData` returns {} (truthy) while loading; the readiness gates
  // and header below treat `undefined` as "not loaded", so map empty → undefined.
  const currentUserData = useCurrentUserData();
  const userData = isEmptyObject(currentUserData) ? undefined : currentUserData;
  const preferences = useCurrentUserPreferences();
  const drinkingSessionData = useCurrentUserDrinkingSessions();
  const {isOffline} = useNetwork();
  const [localVisibleDate, setLocalVisibleDate] = useState<DateData>(
    dateToDateData(new Date()),
  );
  const hasMarkedReadyRef = useRef(false);
  // Most recent completed session, for the "last session" banner (null when
  // there's no history — a brand-new user shows no banner).
  const lastSession = useLastSession();

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

  const monthlyStats = useHomeStats(visibleDate);

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

  // Render the shell + skeletons immediately. Real components swap in for
  // their skeletons as each piece of data resolves. A brand-new user with no
  // sessions gets a welcome/empty state instead of the calendar + stats.
  // Require `profile` (not just `userData`): a failed/incomplete ProvisionUser
  // can leave `userData` truthy while `profile` is still undefined. Gating the
  // header on the profile keeps it from rendering against profile-less data.
  const isUserDataReady = !!userData?.profile;
  // `preferences` / `drinkingSessionData` are undefined only until `app/open`
  // delivers the snapshot (or a warm cache hydrates). While they're unresolved
  // we show skeletons online, or an offline "can't load" notice when offline
  // with nothing cached — never a false "no sessions" welcome. Once resolved,
  // emptiness is authoritative (`app/open` always seeds the user's entry).
  const contentState = getHomeContentState(
    preferences,
    drinkingSessionData,
    isOffline,
  );

  const renderMainContent = () => {
    if (contentState === 'loading') {
      return (
        <>
          <HomeBannerSkeleton />
          <MonthlyOverviewCardSkeleton />
          <SessionsCalendarCompactSkeleton />
        </>
      );
    }
    if (contentState === 'offlineUnavailable') {
      return (
        <NoSessionsInfo
          title={translate('homeScreen.offlineNoData.title')}
          message={translate('homeScreen.offlineNoData.message')}
        />
      );
    }
    if (contentState === 'empty') {
      return <NoSessionsInfo />;
    }
    // contentState === 'data' — both values are resolved; the guard re-narrows
    // them for the type system (and is a harmless defensive fallback).
    if (!preferences || drinkingSessionData === undefined) {
      return null;
    }
    return (
      <>
        {/* The overview sits above the calendar so its position stays fixed as
         *  the user pages months — the calendar's row count (5 vs 6 weeks)
         *  varies, and keeping it last confines that height change to the
         *  bottom of the scroll. */}
        {/* Home stats display toggles — flip these to show/hide sections:
         *   showTitle           — the "This month" heading
         *   showWeeklyUnits     — the per-week units bar chart
         *   showMonthComparison — the trend arrow + previous-month value */}
        <MonthlyOverviewCard
          stats={monthlyStats}
          showTitle
          showWeeklyUnits={false}
          showMonthComparison
        />
        <SessionsCalendar
          userID={user.uid}
          visibleDate={visibleDate}
          onDateChange={onDateChange}
          drinkingSessionData={drinkingSessionData}
          preferences={preferences}
        />
      </>
    );
  };

  // The banner keeps a constant footprint whether or not a session is live, so
  // the calendar below never shifts. A brand-new user (no completed session and
  // not in one) shows no banner.
  const renderBanner = () => {
    if (ongoingSessionData?.ongoing) {
      return (
        <HomeBanner
          tone="active"
          label={translate('homeScreen.banners.inSession.label')}
          detail={translate('homeScreen.banners.inSession.body')}
          actionLabel={translate('homeScreen.banners.inSession.resume')}
          accessibilityLabel={translate('homeScreen.banners.inSession.a11y')}
          onPress={() => DS.navigateToOngoingSessionScreen()}
        />
      );
    }
    if (lastSession) {
      return (
        <HomeBanner
          tone="neutral"
          label={translate('homeScreen.banners.lastSession.label')}
          detail={translate('homeScreen.banners.lastSession.summary', {
            when: lastSession.when,
            units: lastSession.units,
          })}
          accessibilityLabel={translate('homeScreen.banners.lastSession.a11y', {
            when: lastSession.when,
            units: lastSession.units,
          })}
          onPress={() =>
            Navigation.navigate(
              ROUTES.DAY_OVERVIEW.getRoute(user.uid, lastSession.dateString),
            )
          }
        />
      );
    }
    return null;
  };

  return (
    <>
      <ScreenWrapper
        testID={HomeScreen.displayName}
        shouldShowOfflineIndicator={false}
        includeSafeAreaPaddingBottom={getPlatform() !== CONST.PLATFORM.IOS}>
        {/* // TODO rewrite this into the HeaderWithBackButton component */}
        {isUserDataReady ? (
          <View style={[styles.headerBar, styles.borderBottom, styles.ph2]}>
            <View
              style={[
                styles.flexRow,
                styles.alignItemsCenter,
                styles.justifyContentBetween,
                styles.w100,
              ]}>
              <Button
                style={[styles.flexRow, styles.bgTransparent]}
                onPress={() =>
                  Navigation.navigate(ROUTES.PROFILE.getRoute(user.uid))
                }>
                <ProfileImage
                  photoUrl={userData?.profile?.photo_url}
                  style={styles.avatarMedium}
                />
                <Text style={[styles.headerText, styles.textLarge, styles.ml3]}>
                  {userData?.profile?.display_name ?? ''}
                </Text>
                <View style={styles.ml1}>
                  <SupporterBadgeForUser userID={user.uid} size="medium" />
                </View>
              </Button>
              <PressableWithFeedback
                accessibilityLabel={translate('bottomTabBar.badges')}
                role={CONST.ROLE.BUTTON}
                onPress={() => Navigation.navigate(ROUTES.BADGES)}>
                <Icon
                  src={KirokuIcons.Star}
                  fill={theme.icon}
                  width={24}
                  height={24}
                />
              </PressableWithFeedback>
            </View>
          </View>
        ) : (
          <HomeHeaderSkeleton />
        )}
        <ScrollView
          contentContainerStyle={[
            styles.ph4,
            {paddingBottom: bottomTabBarHeight + 16},
          ]}>
          {renderBanner()}
          {renderMainContent()}
        </ScrollView>
        <OfflineIndicator style={{marginBottom: bottomTabBarHeight}} />
        {/* Start-session FAB, floating bottom-right above the bottom tab bar.
            Home-only so the session modal's back-nav assumption (Home sits
            underneath the modal) stays intact. The bottom offset clears the
            native tab bar so the FAB doesn't merge with the rightmost tab. */}
        <View
          style={[
            styles.floatingActionButtonContainer,
            {bottom: bottomTabBarHeight + 16},
          ]}>
          <StartSessionButtonAndPopover />
        </View>
      </ScreenWrapper>
      {/* Active operations (e.g. saving a session) take a full-screen overlay so
          they don't compete with the home UI for attention. Rendered as an
          overlay layer (not an early-return) so the heavy compact calendar stays
          mounted underneath: a transient loadingText must not tear it down and
          force a from-scratch re-render (the synchronous useLazyMarkedDates
          re-index) when it clears. */}
      {!!loadingText && (
        <FullScreenLoadingIndicator loadingText={loadingText} />
      )}
    </>
  );
}

HomeScreen.displayName = 'Home Screen';
export default HomeScreen;
