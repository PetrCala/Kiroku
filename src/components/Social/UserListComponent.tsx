import PressableWithAnimation from '@components/Buttons/PressableWithAnimation';
import {useFirebase} from '@context/global/FirebaseContext';
import {fetchUserStatuses} from '@database/profile';
import useProfileList from '@hooks/useProfileList';
import {isNonEmptyArray} from '@libs/Validation';
import {
  calculateAllUsersPriority,
  orderUsersByPriority,
} from '@libs/algorithms/DisplayPriority';
import type {UserStatusList} from '@src/types/onyx';
import type {UserArray} from '@src/types/onyx/OnyxCommon';
import React, {useState, useEffect} from 'react';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import UserOverview from './UserOverview';
import commonStyles from '@src/styles/commonStyles';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import FillerView from '@components/FillerView';
import {sleep} from '@libs/TimeUtils';
import _ from 'lodash';
import CONST from '@src/CONST';
import useThemeStyles from '@hooks/useThemeStyles';
import useTheme from '@hooks/useTheme';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';

type UserListProps = {
  fullUserArray: UserArray;
  initialLoadSize: number;
  emptyListComponent?: React.ReactNode;
  userSubset?: UserArray;
  orderUsers?: boolean;
};

/**
 * A component for lazy data loading and display of a list of users.
 * Utilizes the UserList object to store user data.
 *
 * @param fullUserArray - An array of user IDs to display.
 * @param initialLoadSize - The number of users to load initially.
 * @param userSubset - An optional subset of the full user array to display.
 * @param orderUsers - If true, the users will be ordered by display priority.
 * @returns A component for lazy data loading and display of a list of users.
 */
const UserListComponent: React.FC<UserListProps> = ({
  fullUserArray,
  initialLoadSize,
  emptyListComponent,
  userSubset,
  orderUsers,
}) => {
  const {auth, db} = useFirebase();
  const styles = useThemeStyles();
  const theme = useTheme();
  const user = auth.currentUser;
  // Partial list of users for initial display and dynamic updates
  const [displayUserArray, setDisplayUserArray] = useState<UserArray>([]);
  const [userStatusList, setUserStatusList] = useState<UserStatusList>({});
  const [currentLoadSize, setCurrentLoadSize] =
    useState<number>(initialLoadSize);
  const {loadingDisplayData, profileList} = useProfileList(displayUserArray);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const loadMoreUsers = async (additionalCount: number) => {
    const arrayToSlice = userSubset ?? fullUserArray;
    const newLoadSize = Math.min(
      currentLoadSize + additionalCount,
      arrayToSlice.length,
    );
    if (newLoadSize <= currentLoadSize) {
      return;
    } // No more users to load
    setLoadingMoreUsers(true);
    const additionalUsers = arrayToSlice.slice(currentLoadSize, newLoadSize);
    setDisplayUserArray([
      ...new Set([...displayUserArray, ...additionalUsers]),
    ]);
    setCurrentLoadSize(newLoadSize);
    await sleep(500); // Give the user list time to update
    setLoadingMoreUsers(false);
  };

  const handleScroll = async (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const y = event.nativeEvent.contentOffset.y;
    const height = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;

    // Check for more users to load upon reaching the bottom
    if (y + height >= contentHeight - 20) {
      await loadMoreUsers(initialLoadSize);
    }
  };

  const navigateToProfile = (userID: string): void => {
    Navigation.navigate(ROUTES.PROFILE.getRoute(userID));
  };

  // Monitor the user status list
  useEffect(() => {
    async function fetchUsers() {
      if (!isNonEmptyArray(fullUserArray)) {
        setUserStatusList({});
        return;
      }
      const newUsers = fullUserArray.filter(userID => !userStatusList[userID]);
      if (isNonEmptyArray(newUsers)) {
        const newUserStatusList: UserStatusList = await fetchUserStatuses(
          db,
          newUsers,
        );
        setUserStatusList({...userStatusList, ...newUserStatusList});
      }
    }
    fetchUsers();
  }, [initialLoadSize, fullUserArray]);

  // Update the display list when the user status list changes
  useEffect(() => {
    const updateDisplayArray = () => {
      // No users to display
      if (!isNonEmptyArray(fullUserArray) || !isNonEmptyArray(userSubset)) {
        setDisplayUserArray([]);
        setIsInitialLoad(false);
        return;
      }
      // Data not yet initialized during the initial load
      if (isEmptyObject(userStatusList)) {
        return;
      }
      let arrayToSlice = userSubset ?? fullUserArray;
      if (orderUsers) {
        const userPriorityList = calculateAllUsersPriority(
          fullUserArray,
          userStatusList,
        );
        arrayToSlice = orderUsersByPriority(arrayToSlice, userPriorityList);
      }
      const newDisplayArray = arrayToSlice.slice(0, currentLoadSize);
      setDisplayUserArray(newDisplayArray);
      setIsInitialLoad(false);
    };

    updateDisplayArray();
  }, [userStatusList, userSubset]); // Full array changes change the status list

  return (
    <ScrollView
      style={localStyles.scrollViewContainer}
      onScrollBeginDrag={Keyboard.dismiss}
      onMomentumScrollEnd={handleScroll}
      scrollEventThrottle={400}
      keyboardShouldPersistTaps="handled">
      {loadingDisplayData && isInitialLoad ? (
        <FlexibleLoadingIndicator />
      ) : isNonEmptyArray(fullUserArray) ? (
        <>
          <View style={localStyles.userList}>
            {isNonEmptyArray(displayUserArray) ? (
              _.map(displayUserArray, (userID: string) => {
                const profileData = profileList[userID] ?? {};
                const userStatusData = userStatusList[userID] ?? {};

                // Catch the initial load of the user list (profileList and userStatusList are empty objects at first)
                if (
                  isEmptyObject(profileData) ||
                  isEmptyObject(userStatusData)
                ) {
                  return null;
                }
                return (
                  <PressableWithAnimation
                    key={userID + '-button'}
                    style={localStyles.friendOverviewButton}
                    onPress={() => navigateToProfile(userID)}>
                    <UserOverview
                      key={userID + '-user-overview'}
                      userID={userID}
                      profileData={profileData}
                      userStatusData={userStatusData}
                    />
                  </PressableWithAnimation>
                );
              })
            ) : (
              <Text style={commonStyles.noUsersFoundText}>
                {`No friends found.\n\nTry modifying the search text.`}
              </Text>
            )}
          </View>
          {loadingMoreUsers ? (
            <View style={localStyles.loadingMoreUsersContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
            </View>
          ) : (
            <FillerView height={100} />
          )}
        </>
      ) : (
        emptyListComponent
      )}
    </ScrollView>
  );
};

const screenHeight = Dimensions.get('window').height;

const localStyles = StyleSheet.create({
  scrollViewContainer: {
    flex: 1,
    // backgroundColor: 'white',
    // justifyContent: 'center',
  },
  loadingContainer: {
    width: '100%',
    height: screenHeight * 0.8,
  },
  userList: {
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingTop: 5,
  },
  friendOverviewButton: {
    width: '100%',
    maxHeight: 100,
    backgroundColor: 'white',
  },
  loadingMoreUsersContainer: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  loadingMoreUsersText: {
    fontSize: 18,
    fontWeight: '400',
    color: 'black',
  },
});

export default UserListComponent;
