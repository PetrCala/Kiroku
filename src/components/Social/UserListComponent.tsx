import {
  calculateAllUsersPriority,
  orderUsersByPriority,
} from '@libs/algorithms/DisplayPriority';
import type {ProfileList, UserStatusList} from '@src/types/onyx';
import type {UserArray} from '@src/types/onyx/OnyxCommon';
import React, {useState} from 'react';
import type {ListRenderItemInfo} from 'react-native';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import useThemeStyles from '@hooks/useThemeStyles';
import {View} from 'react-native';
import FlatList from '@components/FlatList';
import {PressableWithFeedback} from '@components/Pressable';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import FriendOfflineFeedback from './FriendOfflineFeedback';
import UserOverview from './UserOverview';
import UserOverviewSkeleton from './UserOverviewSkeleton';

/** Upper bound on cold-load placeholder rows: enough to fill a tall phone
 *  screen; anything below the fold would render (and animate) unseen. */
const MAX_SKELETON_ROWS = 10;

type UserListProps = {
  fullUserArray: UserArray;
  initialLoadSize: number;
  /** Profile map for the users, supplied by the parent's single
   *  [[useFriendsData]] instance (read back from Onyx). */
  profileList: ProfileList;
  /** Status map for the users, supplied by the same hook. */
  userStatusList: UserStatusList;
  emptyListComponent?: React.JSX.Element;
  userSubset?: UserArray;
  orderUsers?: boolean;
  isLoading?: boolean;
};

/**
 * Renders a windowed, display-priority-ordered list of users.
 *
 * Data-fetching lives in the parent's [[useFriendsData]] hook (one combined
 * profile+status batch read, cached in Onyx); this component is now pure
 * presentation. Pagination is render-only — `onEndReached` just widens the
 * rendered window over the already-loaded array, so scrolling never triggers a
 * network request (this removed the old per-slice profile re-fetch + race).
 *
 * @param fullUserArray - The full set of user IDs (drives priority ordering).
 * @param initialLoadSize - How many users to render initially / per page.
 * @param profileList - Profile data for the users, keyed by user ID.
 * @param userStatusList - Presence/status data for the users, keyed by user ID.
 * @param userSubset - An optional subset (e.g. search results) to render.
 * @param orderUsers - If true, order the users by display priority.
 * @param isLoading - Cold-load gate from the parent; shows the full-screen
 *   spinner. Never set once the list has data, so the list never blanks out.
 */
function UserListComponent({
  fullUserArray,
  initialLoadSize,
  profileList,
  userStatusList,
  emptyListComponent,
  userSubset,
  orderUsers,
  isLoading,
}: UserListProps) {
  const styles = useThemeStyles();
  const userData = useCurrentUserData();
  const {translate} = useLocalize();
  const [currentLoadSize, setCurrentLoadSize] =
    useState<number>(initialLoadSize);

  const arrayToSlice = userSubset ?? fullUserArray;
  // Order by priority (active/recent sessions first) then window for render.
  // Both are render-only: all profile/status data is already in Onyx, so this
  // never fetches. `orderUsersByPriority` returns a copy, so `arrayToSlice` is
  // not mutated.
  const orderedArray = orderUsers
    ? orderUsersByPriority(
        arrayToSlice,
        calculateAllUsersPriority(fullUserArray, userStatusList),
      )
    : arrayToSlice;
  const displayUserArray = orderedArray.slice(0, currentLoadSize);

  const loadMoreUsers = () => {
    const newLoadSize = Math.min(
      currentLoadSize + initialLoadSize,
      arrayToSlice.length,
    );
    if (newLoadSize <= currentLoadSize) {
      return; // No more users to render
    }
    setCurrentLoadSize(newLoadSize);
  };

  const navigateToProfile = (userID: string): void => {
    Navigation.navigate(ROUTES.PROFILE.getRoute(userID));
  };

  const renderItem = ({item, index}: ListRenderItemInfo<string>) => {
    const userID = item;
    const profileData = profileList[userID] ?? {};
    const userStatusData = userStatusList[userID] ?? {};

    // No profile means the server evicted everything (block, ban, or a deleted
    // account) — there's nothing to show, so keep the row hidden.
    if (isEmptyObject(profileData)) {
      return null;
    }
    // Profile present but status evicted → the friend hid their drinking data
    // (`hide_from_all` / `hidden_from`). Still list them by name + avatar; the
    // `isPrivate` branch in UserOverview shows a neutral marker instead of any
    // activity info.
    const isPrivate = isEmptyObject(userStatusData);

    return (
      <FriendOfflineFeedback key={`${index}-user-feedback`} userID={userID}>
        <PressableWithFeedback
          accessibilityLabel={`${index}-user-button`}
          onPress={() => navigateToProfile(userID)}>
          <UserOverview
            key={`${index}-user-overview`}
            userID={userID}
            profileData={profileData}
            userStatusData={userStatusData}
            timezone={userData?.timezone}
            isPrivate={isPrivate}
          />
        </PressableWithFeedback>
      </FriendOfflineFeedback>
    );
  };

  if (isLoading) {
    // Cold load: the first paint of real data should already be live (fresh
    // ordering + statuses), so hold row-shaped skeletons instead of painting a
    // stale snapshot that would visibly reshuffle a round trip later. One
    // skeleton per known friend, bounded to a screenful.
    const skeletonCount = Math.min(
      Math.max(fullUserArray.length, 1),
      initialLoadSize,
      MAX_SKELETON_ROWS,
    );
    return (
      <View
        style={[styles.flex1, styles.pt1]}
        accessibilityLabel={translate('common.loading')}>
        {Array.from({length: skeletonCount}, (_, index) => (
          // Static placeholder list: index keys are stable here.
          // eslint-disable-next-line react/no-array-index-key
          <UserOverviewSkeleton key={`user-overview-skeleton-${index}`} />
        ))}
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
      onEndReached={loadMoreUsers}
      onEndReachedThreshold={0.75}
      ListEmptyComponent={emptyListComponent}
    />
  );
}

export default UserListComponent;
