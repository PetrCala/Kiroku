import React, {useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import SessionsCalendar from '@components/SessionsCalendar';
import type {DateData} from 'react-native-calendars';
import {
  calculateThisMonthUnits,
  timestampToDate,
  dateToDateData,
} from '@libs/DataHandling';
import {useUserConnection} from '@context/global/UserConnectionContext';
import UserOffline from '@components/UserOfflineModal';
import {synchronizeUserStatus} from '@userActions/User';
import {useFirebase} from '@context/global/FirebaseContext';
import ProfileImage from '@components/ProfileImage';
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
import * as ErrorUtils from '@libs/ErrorUtils';
import * as Session from '@userActions/Session';
import Timing from '@userActions/Timing';
import ScrollView from '@components/ScrollView';
import useLocalize from '@hooks/useLocalize';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import NoSessionsInfo from '@components/NoSessionsInfo';
import Text from '@components/Text';
import BottomTabBar from '@libs/Navigation/AppNavigator/createCustomBottomTabNavigator/BottomTabBar';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import ERRORS from '@src/ERRORS';
import Button from '@components/Button';

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
  const {drinkingSessionData, preferences, userData} = useDatabaseData();
  const [visibleDate, setVisibleDate] = useState<DateData>(
    dateToDateData(new Date()),
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Derive stats synchronously from the visible month + drink unit mapping.
  // Narrowed to `drinksToUnits` so unrelated preference updates (e.g. picking
  // a color palette) don't recompute the stats.
  const drinksToUnits = preferences?.drinks_to_units;
  const {drinkingSessionsCount, unitsConsumed} = useMemo(() => {
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

  useEffect(() => {
    if (!!loadingText || !preferences || !userData || !user) {
      return;
    }
    Session.setHasCheckedAutoLogin(true);
    setIsLoading(false);
    Timing.end(CONST.TIMING.HOMEPAGE_INITIAL_RENDER);
  }, [loadingText, preferences, userData, user]);

  if (!user) {
    throw new Error(translate('common.error.userNull'));
  }

  if (!isOnline) {
    return <UserOffline />;
  }

  if (isLoading || !preferences || !userData) {
    return <FullScreenLoadingIndicator loadingText={loadingText} />;
  }

  return (
    <ScreenWrapper
      testID={HomeScreen.displayName}
      includePaddingTop={false}
      includeSafeAreaPaddingBottom={getPlatform() !== CONST.PLATFORM.IOS}>
      {/* // TODO rewrite this into the HeaderWithBackButton component */}
      <View style={[styles.headerBar, styles.borderBottom]}>
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
      <ScrollView>
        {!!ongoingSessionData?.ongoing && (
          <MessageBanner
            danger
            text={translate('homeScreen.currentlyInSession')}
            onPress={() => DS.navigateToOngoingSessionScreen()}
          />
        )}
        {drinkingSessionData ? (
          <>
            <StatOverview statsData={statsData} />
            <SessionsCalendar
              userID={user.uid}
              visibleDate={visibleDate}
              onDateChange={setVisibleDate}
              drinkingSessionData={drinkingSessionData}
              preferences={preferences}
            />
          </>
        ) : (
          <NoSessionsInfo />
        )}
      </ScrollView>
      <BottomTabBar />
    </ScreenWrapper>
  );
}

HomeScreen.displayName = 'Home Screen';
export default HomeScreen;
