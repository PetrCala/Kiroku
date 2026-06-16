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
import {selectCalendarVisibleSource} from '@libs/SessionsCalendarUtils';
import SessionsCalendar from '@components/SessionsCalendar';
import SessionsCalendarCompactSkeleton from '@components/SessionsCalendar/SessionsCalendarCompactSkeleton';
import {getCommonFriendsCount} from '@libs/FriendUtils';
import {isBlocked} from '@libs/BlockUtils';
import * as FeatureFlags from '@libs/FeatureFlags';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Icon from '@components/Icon';
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
import useNetwork from '@hooks/useNetwork';

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
  const {isOffline} = useNetwork();
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
  const [lastViewedByUser] = useOnyx(ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE);
  // This user's OWN last-viewed day (narrow primitive so the memo below only
  // re-runs when THIS user's entry changes, not on any other user's).
  const lastViewedForUser = lastViewedByUser?.[userID];
  // The calendar's visible month: the viewed user's last-scrolled day from an
  // enlarged calendar when present, otherwise the locally-navigated month,
  // otherwise today. Derived (not synced via an effect) so it's already correct
  // on the first render after the modal dismisses — the profile updates while
  // still hidden underneath, so the user never sees the month flip.
  //
  // `NVP_LAST_VIEWED_CALENDAR_DATE` is keyed PER VIEWED USER, so this restores a
  // friend's last position the same way it does the signed-in user's, while one
  // user's entry can never leak onto another's calendar (Rule 2 — structural,
  // since we only ever read `[userID]`). The whole map is cleared on app launch,
  // so a user viewed for the first time this session opens on today. The local
  // month only applies while it still belongs to the user on screen; on a user
  // change it's stale, so we fall back to today (reused instance, friend A → B).
  const visibleDateData = useMemo(() => {
    const source = selectCalendarVisibleSource({
      hasLastViewed: !!lastViewedForUser,
      localBelongsToViewedUser: localVisible.userID === userID,
    });
    if (source === 'lastViewed' && lastViewedForUser) {
      return dateToDateData(dateStringToDate(lastViewedForUser));
    }
    if (source === 'local') {
      return localVisible.date;
    }
    return dateToDateData(new Date());
  }, [lastViewedForUser, localVisible.date, localVisible.userID, userID]);
  // Manual month navigation overrides the restored scroll position. Re-tag with
  // the current user so the derivation keeps using it for this visit, and clear
  // ONLY this user's own per-user slot (never another user's; Rule 2).
  const onDateChange = useCallback(
    (date: DateData) => {
      setLocalVisible({userID, date});
      App.clearLastViewedCalendarDate(userID);
    },
    [userID],
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
  // A friend who hid their drinking data (`hide_from_all` / `hidden_from`)
  // returns a readable profile, but the server evicts their preferences,
  // sessions, and status (#786). That is NOT an unreachable profile: render it
  // with a "private" notice in place of the sessions overview + calendar.
  // Online-gated so an offline read that simply hasn't landed still falls
  // through to the "couldn't load / reconnect" state below.
  const isPrivateProfile =
    !isSelf &&
    !isViewingBlockedUser &&
    !isOffline &&
    !!profileData &&
    !!userData &&
    !preferences;

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
  // Full-screen "couldn't load" only when the profile is genuinely unreachable:
  // no profile (deleted, or they blocked us), we blocked them, or we're offline
  // without cached preferences to render. A friend who merely hid their data
  // (`isPrivateProfile`) is reachable and online, so it's excluded here and
  // renders below with a private notice instead of a surfaced error.
  if (
    !isPrivateProfile &&
    (!profileData || !preferences || !userData || isViewingBlockedUser)
  ) {
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
          {preferences ? (
            <>
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
            </>
          ) : (
            <View
              style={[
                styles.alignItemsCenter,
                styles.justifyContentCenter,
                styles.ph5,
                styles.mt5,
              ]}>
              <Icon
                src={KirokuIcons.Lock}
                fill={StyleUtils.getIconFillColor()}
                medium
              />
              <Text
                style={[
                  styles.textHeadlineH1,
                  styles.textAlignCenter,
                  styles.mt2,
                ]}>
                {translate('profileScreen.privateTitle')}
              </Text>
              <Text
                style={[
                  styles.textNormal,
                  styles.textSupporting,
                  styles.textAlignCenter,
                  styles.mt2,
                ]}>
                {translate('profileScreen.privateMessage')}
              </Text>
            </View>
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
