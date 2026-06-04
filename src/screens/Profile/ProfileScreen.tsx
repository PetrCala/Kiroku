import {View} from 'react-native';
import type {DateData} from 'react-native-calendars';
import {useFirebase} from '@context/global/FirebaseContext';
import * as Profile from '@userActions/Profile';
import type {StatData} from '@components/Items/StatOverview';
import StatOverview from '@components/Items/StatOverview';
import ProfileOverview from '@components/Social/ProfileOverview';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import * as App from '@userActions/App';
import {readDataOnce} from '@database/baseFunctions';
import {
  calculateThisMonthUnits,
  dateToDateData,
  dateStringToDate,
  objKeys,
  timestampToDate,
} from '@libs/DataHandling';
import SessionsCalendar from '@components/SessionsCalendar';
import SessionsCalendarCompactSkeleton from '@components/SessionsCalendar/SessionsCalendarCompactSkeleton';
import {getCommonFriendsCount} from '@libs/FriendUtils';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import type {DrinkingSessionArray} from '@src/types/onyx';
import type {DateString, UserList} from '@src/types/onyx/OnyxCommon';
import type {StackScreenProps} from '@react-navigation/stack';
import type {ProfileNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import Navigation from '@libs/Navigation/Navigation';
import DBPATHS from '@src/DBPATHS';
import ROUTES from '@src/ROUTES';
import useFetchData from '@hooks/useFetchData';
import useDrinkingSessionsFetch from '@hooks/useDrinkingSessionsFetch';
import ScreenWrapper from '@components/ScreenWrapper';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useReadyAfterScreenTransition from '@hooks/useReadyAfterScreenTransition';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import useThemeStyles from '@hooks/useThemeStyles';
import Button from '@components/Button';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import ManageFriendPopover from '@components/ManageFriendPopover';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useStyleUtils from '@hooks/useStyleUtils';
import FriendDayDrillDownSheet from './FriendDayDrillDownSheet';

type ProfileScreenProps = StackScreenProps<
  ProfileNavigatorParamList,
  typeof SCREENS.PROFILE.ROOT
>;

function ProfileScreen({route}: ProfileScreenProps) {
  const {auth, db} = useFirebase();
  const {userID} = route.params;
  const user = auth.currentUser;
  // `drinkingSessionData` is fetched separately via `useDrinkingSessionsFetch`
  // — that hook windows the Firebase query by `start_time` and re-fetches when
  // the calendar widens. `useFetchData` stays for the non-windowed keys.
  const relevantDataKeys: FetchDataKeys = ['userData', 'preferences'];
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {data: fetchedData, isLoading: isFetchLoading} = useFetchData(
    userID,
    relevantDataKeys,
  );
  const {
    data: drinkingSessionData,
    isLoading: isSessionsLoading,
    isFetchingOlderMonths,
  } = useDrinkingSessionsFetch(userID);
  const isLoading = isFetchLoading || isSessionsLoading;
  // Defer the (heavy) calendar mount until after the navigation slide. The
  // compact `<SessionsCalendar>` runs `useLazyMarkedDates`' synchronous
  // indexing on first render, which otherwise blocks the push slide-in.
  const {isReady: didScreenTransitionEnd, onEntryTransitionEnd} =
    useReadyAfterScreenTransition();
  const [selfFriends, setSelfFriends] = useState<UserList | null | undefined>();
  const [friendCount, setFriendCount] = useState(0);
  const [commonFriendCount, setCommonFriendCount] = useState(0);
  const [localVisibleDateData, setLocalVisibleDateData] = useState(
    dateToDateData(new Date()),
  );
  const [lastViewedCalendarDate] = useOnyx(
    ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE,
  );
  // The calendar's visible month: the last-viewed day from an enlarged calendar
  // when present, otherwise the locally-navigated month. Derived (not synced via
  // an effect) so it's already correct on the first render after the modal
  // dismisses — the profile updates while still hidden underneath, so the user
  // never sees the month flip. Reset on app launch → today.
  const visibleDateData = useMemo(
    () =>
      lastViewedCalendarDate
        ? dateToDateData(dateStringToDate(lastViewedCalendarDate))
        : localVisibleDateData,
    [lastViewedCalendarDate, localVisibleDateData],
  );
  // Manual month navigation overrides the synced value.
  const onDateChange = useCallback((date: DateData) => {
    setLocalVisibleDateData(date);
    App.clearLastViewedCalendarDate();
  }, []);
  const [drinkingSessionsCount, setDrinkingSessionsCount] = useState(0);
  const [unitsConsumed, setUnitsConsumed] = useState(0);
  const [manageFriendModalVisible, setManageFriendModalVisible] =
    useState(false);
  const [drillDownDate, setDrillDownDate] = useState<DateString | null>(null);
  const userData = fetchedData?.userData;
  const preferences = fetchedData?.preferences;
  const profileData = userData?.profile;
  const friends = userData?.friends;

  const statsData: StatData = [
    {
      header: translate('profileScreen.drinkingSessions', {
        sessionsCount: drinkingSessionsCount,
      }),
      content: String(drinkingSessionsCount),
    },
    {
      header: translate('profileScreen.unitsConsumed', {
        unitCount: unitsConsumed,
      }),
      content: String(roundToTwoDecimalPlaces(unitsConsumed)),
    },
  ];

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

  // Track own friends
  useEffect(() => {
    const getOwnFriends = async () => {
      if (!user) {
        return;
      }
      let ownFriends: UserList | null | undefined = friends;
      if (user?.uid !== userID) {
        ownFriends = await readDataOnce<UserList>(
          db,
          DBPATHS.USERS_USER_ID_FRIENDS.getRoute(user.uid),
        );
      }
      setSelfFriends(ownFriends);
    };
    getOwnFriends();
  }, [db, friends, user, userID]);

  // Monitor friends count
  useEffect(() => {
    const newFriendCount = friends ? objKeys(friends).length : 0;
    const newCommonFriendCount = getCommonFriendsCount(
      objKeys(selfFriends),
      objKeys(friends),
    );
    setFriendCount(newFriendCount);
    setCommonFriendCount(newCommonFriendCount);
  }, [friends, selfFriends]);

  // Mirror the viewed user's public `is_supporter` flag into USER_DATA_LIST so
  // SupporterBadgeForUser (which reads from that collection) can render
  // immediately on profiles reached via deep link rather than through a list.
  useEffect(() => {
    if (!userID || userData === undefined) {
      return;
    }
    Profile.setSupporterFlagInList(userID, userData.is_supporter ?? false);
  }, [userID, userData]);

  // Monitor stats
  useEffect(() => {
    if (!drinkingSessionData || !preferences) {
      return;
    }
    const drinkingSessionArray: DrinkingSessionArray =
      Object.values(drinkingSessionData);

    const thisMonthUnits = calculateThisMonthUnits(
      visibleDateData,
      drinkingSessionArray,
      preferences.drinks_to_units,
    );
    const thisMonthSessionCount = DSUtils.getSingleMonthDrinkingSessions(
      timestampToDate(visibleDateData.timestamp),
      drinkingSessionArray,
      false,
    ).length; // Replace this in the future

    setDrinkingSessionsCount(thisMonthSessionCount);
    setUnitsConsumed(thisMonthUnits);
  }, [drinkingSessionData, preferences, visibleDateData]);

  if (isLoading) {
    return <FullScreenLoadingIndicator />;
  }
  if (!profileData || !preferences || !userData) {
    return;
  }

  return (
    <ScreenWrapper
      testID={ProfileScreen.displayName}
      onEntryTransitionEnd={onEntryTransitionEnd}>
      <HeaderWithBackButton
        title={
          user?.uid === userID
            ? translate('profileScreen.title')
            : translate('profileScreen.titleNotSelf')
        }
        onBackButtonPress={Navigation.goBack}
      />
      <ScrollView
        style={[styles.flexGrow1, styles.mnw100]}
        showsVerticalScrollIndicator={false}>
        {user?.uid === userID && (
          <Button
            icon={KirokuIcons.Gear}
            iconFill={StyleUtils.getIconFillColor()}
            style={[styles.editProfileIndicator, styles.bgTransparent]}
            onPress={() => Navigation.navigate(ROUTES.SETTINGS_ACCOUNT)}
          />
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
          <StatOverview statsData={statsData} />
          {didScreenTransitionEnd ? (
            <SessionsCalendar
              userID={userID}
              visibleDate={visibleDateData}
              onDateChange={onDateChange}
              drinkingSessionData={drinkingSessionData}
              preferences={preferences}
              isFetchingOlderMonths={isFetchingOlderMonths}
              onForeignDayPress={setDrillDownDate}
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
      <FriendDayDrillDownSheet
        isVisible={!!drillDownDate}
        onClose={() => setDrillDownDate(null)}
        date={drillDownDate}
        drinkingSessionData={drinkingSessionData}
        preferences={preferences}
      />
    </ScreenWrapper>
  );
}

ProfileScreen.displayName = 'Profile Screen';
export default ProfileScreen;
