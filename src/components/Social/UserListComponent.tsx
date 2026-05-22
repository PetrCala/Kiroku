import {useFirebase} from '@context/global/FirebaseContext';
import * as Profile from '@userActions/Profile';
import useProfileList from '@hooks/useProfileList';
import {isNonEmptyArray} from '@libs/Validation';
import {
  calculateAllUsersPriority,
  orderUsersByPriority,
} from '@libs/algorithms/DisplayPriority';
import type {UserStatusList} from '@src/types/onyx';
import type {UserArray} from '@src/types/onyx/OnyxCommon';
import React, {useState, useEffect, useCallback, useMemo} from 'react';
import type {ListRenderItemInfo} from 'react-native';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import {sleep} from '@libs/TimeUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import {View} from 'react-native';
import FlatList from '@components/FlatList';
import {PressableWithFeedback} from '@components/Pressable';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useLocalize from '@hooks/useLocalize';
import UserOverview from './UserOverview';

type UserListProps = {
  fullUserArray: UserArray;
  initialLoadSize: number;
  emptyListComponent?: React.JSX.Element;
  userSubset?: UserArray;
  orderUsers?: boolean;
  isLoading?: boolean;
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

function UserListComponent({
  fullUserArray,
  initialLoadSize,
  emptyListComponent,
  userSubset,
  orderUsers,
  isLoading,
}: UserListProps) {
  const {db} = useFirebase();
  const styles = useThemeStyles();
  const {userData} = useDatabaseData();
  const {translate} = useLocalize();
  // Partial list of users for initial display and dynamic updates
  const [displayUserArray, setDisplayUserArray] = useState<UserArray>([]);
  const [userStatusList, setUserStatusList] = useState<UserStatusList>({});
  const [currentLoadSize, setCurrentLoadSize] =
    useState<number>(initialLoadSize);
  const {loadingDisplayData, profileList} = useProfileList(displayUserArray);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState<boolean>(false);
  const [isFetchingStatuses, setIsFetchingStatuses] = useState<boolean>(false);
  const [hasComputedOrderedList, setHasComputedOrderedList] =
    useState<boolean>(false);

  const loadMoreUsers = useCallback(
    (additionalCount: number) => {
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
      setDisplayUserArray(prev => [...new Set([...prev, ...additionalUsers])]);
      setCurrentLoadSize(newLoadSize);
      sleep(500).then(() => setLoadingMoreUsers(false));
    },
    [
      userSubset,
      fullUserArray,
      currentLoadSize,
      setLoadingMoreUsers,
      setDisplayUserArray,
      setCurrentLoadSize,
    ],
  );

  const onEndReached = useCallback(() => {
    loadMoreUsers(initialLoadSize);
  }, [initialLoadSize, loadMoreUsers]);

  const navigateToProfile = (userID: string): void => {
    Navigation.navigate(ROUTES.PROFILE.getRoute(userID));
  };

  // Fetch any missing user statuses for the current full user array.
  useEffect(() => {
    async function fetchUsers() {
      if (!isNonEmptyArray(fullUserArray)) {
        // Avoid infinite updates
        if (!isEmptyObject(userStatusList)) {
          setUserStatusList({});
        }
        return;
      }
      const newUsers = fullUserArray.filter(userID => !userStatusList[userID]);
      if (!isNonEmptyArray(newUsers)) {
        return;
      }
      setIsFetchingStatuses(true);
      try {
        const newUserStatusList: UserStatusList =
          await Profile.fetchUserStatuses(db, newUsers);
        setUserStatusList({...userStatusList, ...newUserStatusList});
      } finally {
        setIsFetchingStatuses(false);
      }
    }
    fetchUsers();
  }, [db, initialLoadSize, fullUserArray, userStatusList]);

  // Update the display list when the user status list changes.
  // Defer marking the list as "ready" until the priority sort has actually
  // run against a populated userStatusList — otherwise the initial render
  // would show friends in input order and then visibly re-sort.
  useEffect(() => {
    const updateDisplayArray = () => {
      if (!isNonEmptyArray(fullUserArray)) {
        setDisplayUserArray([]);
        setHasComputedOrderedList(true);
        return;
      }
      if (userSubset !== undefined && !isNonEmptyArray(userSubset)) {
        setDisplayUserArray([]);
        setHasComputedOrderedList(true);
        return;
      }
      if (isEmptyObject(userStatusList)) {
        // Wait for status data before computing the ordered list so we don't
        // briefly render an unsorted slice and then re-order it.
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
      setHasComputedOrderedList(true);
    };

    updateDisplayArray();
  }, [userStatusList, userSubset, currentLoadSize, fullUserArray, orderUsers]);

  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<string>) => {
      const userID = item;
      const profileData = profileList[userID] ?? {};
      const userStatusData = userStatusList[userID] ?? {};

      // Catch the initial load of the user list (profileList and userStatusList are empty objects at first)
      if (isEmptyObject(profileData) || isEmptyObject(userStatusData)) {
        return null;
      }

      return (
        <PressableWithFeedback
          key={`${index}-user-button`}
          accessibilityLabel={`${index}-user-button`}
          onPress={() => navigateToProfile(userID)}>
          <UserOverview
            key={`${index}-user-overview`}
            userID={userID}
            profileData={profileData}
            userStatusData={userStatusData}
            timezone={userData?.timezone}
          />
        </PressableWithFeedback>
      );
    },
    [profileList, userStatusList, userData?.timezone],
  );

  const listFooterComponent = useMemo(() => {
    if (!loadingMoreUsers) {
      return null;
    }
    return <FlexibleLoadingIndicator style={[styles.pt2]} />;
  }, [loadingMoreUsers, styles.pt2]);

  const allStatusesLoaded = useMemo(() => {
    if (!isNonEmptyArray(fullUserArray)) {
      return true;
    }
    return (
      !isFetchingStatuses && fullUserArray.every(id => id in userStatusList)
    );
  }, [fullUserArray, isFetchingStatuses, userStatusList]);

  // Gate on `profileList` being populated rather than the transient
  // `loadingDisplayData` flag. Once we have profiles cached, pagination's
  // background re-fetch (which briefly flips loadingDisplayData back to true)
  // must not unmount the FlatList — doing so resets scroll position and made
  // the list jump to the top whenever onEndReached fired.
  const hasLoadedProfiles = !isEmptyObject(profileList);
  const isListReady =
    hasComputedOrderedList &&
    allStatusesLoaded &&
    (hasLoadedProfiles || !loadingDisplayData);

  if (isLoading || !isListReady) {
    return (
      <View
        style={[
          styles.flex1,
          styles.justifyContentCenter,
          styles.alignItemsCenter,
        ]}>
        <FlexibleLoadingIndicator />
      </View>
    );
  }

  return (
    <FlatList
      accessibilityLabel={translate('friendListScreen.userList')}
      data={displayUserArray}
      renderItem={renderItem}
      style={[]}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={[styles.pt1]}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.75}
      ListEmptyComponent={emptyListComponent}
      ListFooterComponent={listFooterComponent}
    />
  );
}

export default UserListComponent;
