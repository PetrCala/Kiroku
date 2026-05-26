import React from 'react';
import {View} from 'react-native';
import type {Database} from 'firebase/database';
import type {FirebaseStorage} from 'firebase/storage';
import ProfileImage from '@components/ProfileImage';
import {SupporterBadgeForUser} from '@components/SupporterBadge';
import type {FriendRequestStatus, Profile} from '@src/types/onyx';
import useThemeStyles from '@hooks/useThemeStyles';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import SendFriendRequestButton from './SendFriendRequestButton';

type SearchResultProps = {
  userID: string;
  userDisplayData: Profile;
  db: Database;
  storage: FirebaseStorage;
  userFrom: string;
  requestStatus: FriendRequestStatus | undefined;
  alreadyAFriend: boolean;
  customButton?: React.ReactNode;
};

function SearchResult({
  userID,
  userDisplayData,
  db,
  storage,
  userFrom,
  requestStatus,
  alreadyAFriend,
  customButton,
}: SearchResultProps) {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  return (
    <View style={styles.userOverviewContainer}>
      <View style={styles.userOverviewLeftContent}>
        <ProfileImage
          key={`${userID}-profile-icon`}
          storage={storage}
          userID={userID}
          downloadPath={userDisplayData?.photo_url}
          style={styles.avatarLarge}
        />
        <Text style={[styles.headerText, styles.ml3, styles.flexShrink1]}>
          {userDisplayData?.display_name
            ? userDisplayData.display_name
            : translate('common.unknown')}
        </Text>
        <View style={styles.ml1}>
          <SupporterBadgeForUser userID={userID} size="small" />
        </View>
      </View>
      {customButton ?? (
        <SendFriendRequestButton
          db={db}
          userFrom={userFrom}
          userTo={userID}
          requestStatus={requestStatus}
          alreadyAFriend={alreadyAFriend}
        />
      )}
    </View>
  );
}

export default SearchResult;
