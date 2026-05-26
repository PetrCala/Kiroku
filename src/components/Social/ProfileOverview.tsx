import {View} from 'react-native';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {useFirebase} from '@src/context/global/FirebaseContext';
import ProfileImage from '@components/ProfileImage';
import {SupporterBadgeForUser} from '@components/SupporterBadge';
import UploadImageComponent from '@components/UploadImage';
import type {Profile} from '@src/types/onyx';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import Text from '@components/Text';

type ProfileOverviewProps = {
  userID: string;
  profileData: Profile;
};

function ProfileOverview({userID, profileData}: ProfileOverviewProps) {
  const {auth, storage} = useFirebase();
  const styles = useThemeStyles();
  const user = auth.currentUser;
  const {windowWidth} = useWindowDimensions();

  return (
    <View style={[styles.flexColumn, styles.alignItemsCenter, styles.p1]}>
      <ProfileImage
        key={`${userID}-profile-image`}
        storage={storage}
        userID={userID}
        downloadPath={profileData.photo_url}
        style={styles.avatarXLarge}
        enlargable
      />
      {user?.uid === userID && (
        <UploadImageComponent
          pathToUpload={`users/${userID}/profile/profile_image.jpg`}
          src={KirokuIcons.Camera}
          isProfilePicture
          containerStyles={styles.editProfileImageContainer(windowWidth)}
        />
      )}
      <View
        style={[
          styles.flexRow,
          styles.alignItemsCenter,
          styles.mt2,
          styles.p1,
        ]}>
        <Text
          style={[
            styles.textLarge,
            styles.textStrong,
            styles.textAlignCenter,
            styles.flexShrink1,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {profileData.display_name}
        </Text>
        <View style={styles.ml1}>
          <SupporterBadgeForUser userID={userID} size="medium" />
        </View>
      </View>
    </View>
  );
}

export default ProfileOverview;
