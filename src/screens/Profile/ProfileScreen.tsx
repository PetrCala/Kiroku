import {View} from 'react-native';
import type {DateData} from 'react-native-calendars';
import {useFirebase} from '@context/global/FirebaseContext';
import type {StatData} from '@components/Items/StatOverview';
import StatOverview from '@components/Items/StatOverview';
import ProfileOverview from '@components/Social/ProfileOverview';
import React, {useEffect, useMemo, useState} from 'react';
import {readDataOnce} from '@database/baseFunctions';
import {
  calculateThisMonthUnits,
  dateToDateData,
  objKeys,
  timestampToDate,
} from '@libs/DataHandling';
import SessionsCalendar from '@components/SessionsCalendar';
import {getCommonFriendsCount} from '@libs/FriendUtils';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import type {DrinkingSessionArray} from '@src/types/onyx';
import type {UserList} from '@src/types/onyx/OnyxCommon';
import type {StackScreenProps} from '@react-navigation/stack';
import type {ProfileNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import Navigation from '@libs/Navigation/Navigation';
import DBPATHS from '@src/DBPATHS';
import ROUTES from '@src/ROUTES';
import useFetchData from '@hooks/useFetchData';
import ScreenWrapper from '@components/ScreenWrapper';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import useThemeStyles from '@hooks/useThemeStyles';
import Button from '@components/Button';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import ManageFriendPopover from '@components/ManageFriendPopover';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useStyleUtils from '@hooks/useStyleUtils';

type ProfileScreenProps = StackScreenProps<
  ProfileNavigatorParamList,
  typeof SCREENS.PROFILE.ROOT
>;

function ProfileScreen({route}: ProfileScreenProps) {
  const {auth, db} = useFirebase();
  const {userID} = route.params;
  const user = auth.currentUser;
  const relevantDataKeys: FetchDataKeys = [
    'userData',
    'drinkingSessionData',
    'preferences',
  ];
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {data: fetchedData, isLoading} = useFetchData(userID, relevantDataKeys);
  const [selfFriends, setSelfFriends] = useState<UserList | null | undefined>();
  const [friendCount, setFriendCount] = useState(0);
  const [commonFriendCount, setCommonFriendCount] = useState(0);
  const [visibleDateData, setVisibleDateData] = useState(
    dateToDateData(new Date()),
  );
  const [drinkingSessionsCount, setDrinkingSessionsCount] = useState(0);
  const [unitsConsumed, setUnitsConsumed] = useState(0);
  const [manageFriendModalVisible, setManageFriendModalVisible] =
    useState(false);
  const userData = fetchedData?.userData;
  const drinkingSessionData = fetchedData?.drinkingSessionData;
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
    <ScreenWrapper testID={ProfileScreen.displayName}>
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
        {drinkingSessionData ? (
          <View style={[]}>
            <StatOverview statsData={statsData} />
            <SessionsCalendar
              userID={userID}
              visibleDate={visibleDateData}
              onDateChange={(date: DateData) => setVisibleDateData(date)}
              drinkingSessionData={drinkingSessionData}
              preferences={preferences}
            />
          </View>
        ) : (
          <View style={[styles.borderTop, styles.borderRadiusXLarge]}>
            <Text
              style={[styles.textNormal, styles.textAlignCenter, styles.mt4]}>
              {translate('profileScreen.noDrinkingSessions', {
                isSelf: user?.uid === userID,
              })}
            </Text>
          </View>
        )}
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
