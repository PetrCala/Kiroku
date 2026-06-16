import {View} from 'react-native';
import type {DateData} from 'react-native-calendars';
import {useFirebase} from '@context/global/FirebaseContext';
import MonthlyOverviewCard, {
  MonthlyOverviewCardSkeleton,
} from '@components/Items/MonthlyOverviewCard';
import ProfileOverview from '@components/Social/ProfileOverview';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import * as App from '@userActions/App';
import * as Profile from '@userActions/Profile';
import {dateToDateData, dateStringToDate, objKeys} from '@libs/DataHandling';
import {
  canSyncGlobalLastViewedDate,
  selectCalendarVisibleSource,
} from '@libs/SessionsCalendarUtils';
import SessionsCalendar from '@components/SessionsCalendar';
import SessionsCalendarCompactSkeleton from '@components/SessionsCalendar/SessionsCalendarCompactSkeleton';
import {getCommonFriendsCount} from '@libs/FriendUtils';
import {isBlocked} from '@libs/BlockUtils';
import * as FeatureFlags from '@libs/FeatureFlags';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import type {StackScreenProps} from '@react-navigation/stack';
import type {ProfileNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import useFriendProfile from '@hooks/useFriendProfile';
import useFriendPreferences from '@hooks/useFriendPreferences';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useDrinkingSessionsFetch from '@hooks/useDrinkingSessionsFetch';
import useUserMonthlyStats from '@hooks/useUserMonthlyStats';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useReadyAfterScreenTransition from '@hooks/useReadyAfterScreenTransition';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import useThemeStyles from '@hooks/useThemeStyles';
import Button from '@components/Button';
import ManageFriendPopover from '@components/ManageFriendPopover';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useStyleUtils from '@hooks/useStyleUtils';

type ProfileScreenProps = StackScreenProps<
  ProfileNavigatorParamList,
  typeof SCREENS.PROFILE.ROOT
>;

function ProfileScreen({route}: ProfileScreenProps) {
  const {auth} = useFirebase();
  const {userID} = route.params;
  const user = auth.currentUser;
  const isSelf = user?.uid === userID;
  // Friend data now comes from the kiroku-api (privacy-enforced) instead of
  // direct Firebase reads: profile + friends via `useFriendProfile`, rendering
  // preferences via `useFriendPreferences`, and the windowed sessions via
  // `useDrinkingSessionsFetch`.
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {userData, isLoading: isProfileFetchLoading} = useFriendProfile(userID);
  const {preferences, isLoading: isPrefsLoading} = useFriendPreferences(userID);
  // Own sessions come straight off the app/open snapshot in Onyx; the windowed
  // friend fetch runs only for other users' profiles (an empty userID is a
  // no-op, matching SessionsCalendarScreen / DayOverviewScreen).
  const currentUserSessions = useCurrentUserDrinkingSessions();
  const {
    data: friendSessionData,
    isLoading: isFriendSessionsLoading,
    isFetchingOlderMonths: isFetchingFriendOlderMonths,
  } = useDrinkingSessionsFetch(isSelf ? '' : userID);
  const drinkingSessionData = isSelf ? currentUserSessions : friendSessionData;
  const isSessionsLoading = isSelf
    ? currentUserSessions === undefined
    : isFriendSessionsLoading;
  // Self widening needs no fetch — the full own-session snapshot is already
  // cached, so older months are indexed locally.
  const isFetchingOlderMonths = isSelf ? false : isFetchingFriendOlderMonths;
  const isLoading =
    isProfileFetchLoading || isPrefsLoading || isSessionsLoading;
  // Defer the (heavy) calendar mount until after the navigation slide. The
  // compact `<SessionsCalendar>` runs `useLazyMarkedDates`' synchronous
  // indexing on first render, which otherwise blocks the push slide-in.
  const {isReady: didScreenTransitionEnd, onEntryTransitionEnd} =
    useReadyAfterScreenTransition();
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  const [friendCount, setFriendCount] = useState(0);
  const [commonFriendCount, setCommonFriendCount] = useState(0);
  // The locally-navigated month, tagged with the user it was navigated for. The
  // tag lets the derivation below fall back to today when the viewed user
  // changes (the reused-instance edge) without an effect — `setState` in an
  // effect trips `react-hooks/set-state-in-effect`, and a render-phase reset
  // would read a ref during render (rejected by the React Compiler).
  const [localVisible, setLocalVisible] = useState(() => ({
    userID,
    date: dateToDateData(new Date()),
  }));
  const [lastViewedCalendarDate] = useOnyx(
    ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE,
  );
  // The calendar's visible month: the last-viewed day from an enlarged calendar
  // when present, otherwise the locally-navigated month. Derived (not synced via
  // an effect) so it's already correct on the first render after the modal
  // dismisses — the profile updates while still hidden underneath, so the user
  // never sees the month flip. Reset on app launch → today.
  //
  // `NVP_LAST_VIEWED_CALENDAR_DATE` is a single global (non-user-scoped) key, so
  // only the signed-in user's OWN calendar may restore from it. A friend's
  // profile must always open on the current month — otherwise the last-viewed
  // month of a different friend (or of home/self) leaks in, and that stale month
  // also renders empty (it falls outside the fetched window). Friends therefore
  // ignore the NVP entirely and fall back to today. The local month only applies
  // while it still belongs to the user on screen; on a user change it's stale, so
  // we fall back to today (covers a reused screen instance, friend A → friend B).
  const visibleDateData = useMemo(() => {
    const source = selectCalendarVisibleSource({
      isSelf,
      hasLastViewed: !!lastViewedCalendarDate,
      localBelongsToViewedUser: localVisible.userID === userID,
    });
    if (source === 'lastViewed' && lastViewedCalendarDate) {
      return dateToDateData(dateStringToDate(lastViewedCalendarDate));
    }
    if (source === 'local') {
      return localVisible.date;
    }
    return dateToDateData(new Date());
  }, [
    isSelf,
    lastViewedCalendarDate,
    localVisible.date,
    localVisible.userID,
    userID,
  ]);
  // Manual month navigation overrides the synced value. Re-tag with the current
  // user so the derivation keeps using it for this visit only.
  const onDateChange = useCallback(
    (date: DateData) => {
      setLocalVisible({userID, date});
      // Only the signed-in user's OWN calendar may touch the single global
      // last-viewed key. A friend paging their calendar must NOT clear it, or it
      // would wipe the current user's own restored month (Rule 2: one user's
      // calendar never affects another's). For a friend's profile the read-only
      // flag is `!isSelf === true`, so the clear is skipped.
      if (canSyncGlobalLastViewedDate(!isSelf)) {
        App.clearLastViewedCalendarDate();
      }
    },
    [isSelf, userID],
  );
  const profileStats = useUserMonthlyStats({
    userID,
    visibleDate: visibleDateData,
    drinkingSessionData,
    preferences,
    timezone: userData?.timezone?.selected,
    isLoading: isSessionsLoading || isPrefsLoading,
  });
  const [manageFriendModalVisible, setManageFriendModalVisible] =
    useState(false);
  const profileData = userData?.profile;
  const friends = userData?.friends;
  // The common-friends count compares the viewed user's friends against the
  // viewer's OWN. On your own profile they're the same list; otherwise read the
  // viewer's own friends back from Onyx (hydrated below via `openFriendList`).
  const selfFriends =
    user && user.uid !== userID ? userDataList?.[user.uid]?.friends : friends;
  // The signed-in user's own outbound block list. Used to (a) exclude blocked
  // users from the common-friends count and (b) hard-gate the profile of a user
  // we've blocked into the empty state even if a stale cache still holds their
  // data (the server denies block-gated reads, but a cached entry may linger).
  const myBlocked = user ? userDataList?.[user.uid]?.blocked : undefined;
  const isViewingBlockedUser = !isSelf && isBlocked(myBlocked, userID);

  const friendCountLabel = useMemo((): string => {
    return `${translate('profileScreen.commonFriendsLabel', {
      hasCommonFriends: user?.uid !== userID && commonFriendCount > 0,
    })}`;
  }, [translate, user?.uid, userID, commonFriendCount]);

  const friendCountText = useMemo((): string => {
    return `${
      user?.uid !== userID && commonFriendCount > 0
        ? commonFriendCount
        : friendCount
    }`;
  }, [user?.uid, userID, commonFriendCount, friendCount]);

  const onSeeAllFriendsButtonPress = () => {
    const screenRoute =
      user?.uid === userID
        ? ROUTES.SOCIAL
        : ROUTES.PROFILE_FRIENDS_FRIENDS.getRoute(userID);
    Navigation.navigate(screenRoute);
  };

  // Hydrate the viewer's own friends (for the common-friends count) when viewing
  // someone else's profile, via the kiroku-api instead of a direct Firebase read.
  useEffect(() => {
    if (!user || user.uid === userID) {
      return;
    }
    Profile.openFriendList(user.uid);
  }, [user, userID]);

  // Monitor friends count
  useEffect(() => {
    const newFriendCount = friends ? objKeys(friends).length : 0;
    const newCommonFriendCount = getCommonFriendsCount(
      objKeys(selfFriends),
      objKeys(friends),
      myBlocked,
    );
    setFriendCount(newFriendCount);
    setCommonFriendCount(newCommonFriendCount);
  }, [friends, selfFriends, myBlocked]);

  const header = (
    <HeaderWithBackButton
      title={
        user?.uid === userID
          ? translate('profileScreen.title')
          : translate('profileScreen.titleNotSelf')
      }
      onBackButtonPress={Navigation.goBack}
    />
  );

  // A cross-user profile read can't be queued while offline, so a friend whose
  // data isn't already cached resolves with nothing. Keep the screen chrome
  // (ScreenWrapper renders its own OfflineIndicator) and show a graceful
  // loading/empty state rather than the blank dark screen an early `return`
  // produced.
  //
  // Consumption filter (#760): when the signed-in user has blocked this user,
  // skip the loading state entirely and fall straight through to the empty
  // state below, so a stale cache can never flash their sessions/profile.
  if (isLoading && !isViewingBlockedUser) {
    return (
      <ScreenWrapper
        testID={ProfileScreen.displayName}
        onEntryTransitionEnd={onEntryTransitionEnd}>
        {header}
        <View
          style={[
            styles.flex1,
            styles.justifyContentCenter,
            styles.alignItemsCenter,
          ]}>
          <FlexibleLoadingIndicator />
        </View>
      </ScreenWrapper>
    );
  }
  // A blocked/blocking user resolves with no profile (we blocked them, or they
  // blocked us and the server denied/evicted the read), so this is a clean empty
  // state with no sessions and no common-friends count — never a surfaced error.
  if (!profileData || !preferences || !userData || isViewingBlockedUser) {
    return (
      <ScreenWrapper
        testID={ProfileScreen.displayName}
        onEntryTransitionEnd={onEntryTransitionEnd}>
        {header}
        <View
          style={[
            styles.flex1,
            styles.justifyContentCenter,
            styles.alignItemsCenter,
            styles.ph5,
          ]}>
          <Text style={[styles.textHeadlineH1, styles.textAlignCenter]}>
            {translate('profileScreen.offlineUnavailableTitle')}
          </Text>
          <Text
            style={[
              styles.textNormal,
              styles.textSupporting,
              styles.textAlignCenter,
              styles.mt2,
            ]}>
            {translate('profileScreen.offlineUnavailableMessage')}
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      testID={ProfileScreen.displayName}
      onEntryTransitionEnd={onEntryTransitionEnd}>
      {header}
      <ScrollView
        style={[styles.flexGrow1, styles.mnw100]}
        showsVerticalScrollIndicator={false}>
        {user?.uid === userID && (
          <>
            {FeatureFlags.isEnabled('BADGES') && (
              <Button
                icon={KirokuIcons.Star}
                iconFill={StyleUtils.getIconFillColor()}
                style={[styles.profileBadgesIndicator, styles.bgTransparent]}
                onPress={() => Navigation.navigate(ROUTES.BADGES)}
              />
            )}
            <Button
              icon={KirokuIcons.Gear}
              iconFill={StyleUtils.getIconFillColor()}
              style={[styles.editProfileIndicator, styles.bgTransparent]}
              onPress={() => Navigation.navigate(ROUTES.SETTINGS_ACCOUNT)}
            />
          </>
        )}
        <ProfileOverview
          userID={userID}
          profileData={profileData} // For live propagation of current user
        />
        <View style={[styles.profileFriendsInfoContainer, styles.borderBottom]}>
          <View style={[styles.flexGrow1, styles.flexRow]}>
            <Text>{friendCountLabel}</Text>
            <Text style={styles.ml2}>{friendCountText}</Text>
          </View>
          <Button
            text={translate('profileScreen.seeAllFriends')}
            style={[styles.bgTransparent, styles.p0]}
            textStyles={styles.link}
            onPress={onSeeAllFriendsButtonPress}
          />
        </View>
        <View style={styles.ph2}>
          {didScreenTransitionEnd ? (
            <MonthlyOverviewCard
              stats={profileStats}
              showWeeklyUnits={false}
              showMonthComparison
              interactive={isSelf}
              showArrow={isSelf}
            />
          ) : (
            <MonthlyOverviewCardSkeleton />
          )}
          {didScreenTransitionEnd ? (
            <SessionsCalendar
              userID={userID}
              visibleDate={visibleDateData}
              onDateChange={onDateChange}
              drinkingSessionData={drinkingSessionData}
              preferences={preferences}
              isFetchingOlderMonths={isFetchingOlderMonths}
            />
          ) : (
            <SessionsCalendarCompactSkeleton />
          )}
        </View>
        <View style={[styles.flexRow, styles.justifyContentEnd]}>
          {user?.uid !== userID && (
            <Button
              text={translate('common.manage')}
              style={styles.m2}
              onPress={() => setManageFriendModalVisible(true)}
            />
          )}
        </View>
      </ScrollView>
      <ManageFriendPopover
        isVisible={manageFriendModalVisible}
        onClose={() => setManageFriendModalVisible(false)}
        friendId={userID}
      />
    </ScreenWrapper>
  );
}

ProfileScreen.displayName = 'Profile Screen';
export default ProfileScreen;
