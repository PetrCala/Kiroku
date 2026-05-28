import React, {useEffect, useState} from 'react';
import type {ImageSourcePropType, ImageStyle, StyleProp} from 'react-native';
import {Image} from 'expo-image';
import type {FirebaseStorage} from 'firebase/storage';
import getProfilePictureURL from '@src/storage/storageProfile';
import CONST from '@src/CONST';
import * as ErrorUtils from '@libs/ErrorUtils';
import ERRORS from '@src/ERRORS';
import useTheme from '@hooks/useTheme';
import * as KirokuIcons from './Icon/KirokuIcons';
import EnlargableImage from './Buttons/EnlargableImage';

type ProfileImageProps = {
  storage: FirebaseStorage;
  userID: string;
  downloadPath: string | null | undefined;
  style: StyleProp<ImageStyle>;
  refreshTrigger?: number; // Likely a number, used to force a refresh
  enlargable?: boolean;
};

function ProfileImage({
  storage,
  userID,
  downloadPath,
  style,
  refreshTrigger,
  enlargable,
}: ProfileImageProps) {
  const theme = useTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Resolve the Firebase Storage download URL once per source change. Image
  // caching is delegated to expo-image's `cachePolicy`, so no custom layer is
  // needed here.
  useEffect(() => {
    let isActive = true;

    const resolveImageUrl = async () => {
      // A locally-stored file (e.g. a freshly picked image) is used directly.
      if (downloadPath?.startsWith(CONST.LOCAL_IMAGE_PREFIX)) {
        if (isActive) {
          setImageUrl(downloadPath);
        }
        return;
      }

      // A Firebase Storage path must be resolved to a download URL.
      if (downloadPath?.includes(CONST.FIREBASE_STORAGE_URL)) {
        try {
          const url = await getProfilePictureURL(storage, userID, downloadPath);
          if (isActive) {
            setImageUrl(url && url !== CONST.NO_IMAGE ? url : null);
          }
        } catch (error) {
          ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.FETCH_FAILED, error);
          if (isActive) {
            setImageUrl(null);
          }
        }
        return;
      }

      if (isActive) {
        setImageUrl(null);
      }
    };

    resolveImageUrl();

    return () => {
      isActive = false;
    };
  }, [storage, userID, downloadPath, refreshTrigger]);

  const iconTint = imageUrl ? undefined : theme.icon;

  if (enlargable) {
    const imageSource: ImageSourcePropType = imageUrl
      ? {uri: imageUrl}
      : KirokuIcons.UserIcon;
    return (
      <EnlargableImage
        imageSource={imageSource}
        imageStyle={[style, {tintColor: iconTint}]}
      />
    );
  }

  return (
    <Image
      source={imageUrl ? {uri: imageUrl} : KirokuIcons.UserIcon}
      placeholder={KirokuIcons.UserIcon}
      placeholderContentFit="cover"
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={0}
      tintColor={iconTint}
      style={style}
    />
  );
}

export default ProfileImage;
