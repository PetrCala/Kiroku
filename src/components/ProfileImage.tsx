import React, {useEffect, useState} from 'react';
import type {
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import type {FirebaseStorage} from 'firebase/storage';
import getProfilePictureURL from '@src/storage/storageProfile';
import CONST from '@src/CONST';
import * as ErrorUtils from '@libs/ErrorUtils';
import ERRORS from '@src/ERRORS';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as KirokuIcons from './Icon/KirokuIcons';
import FlexibleLoadingIndicator from './FlexibleLoadingIndicator';
import EnlargableImage from './Buttons/EnlargableImage';

// Delay before the loading spinner appears. Fast (cached) loads resolve well
// within this window, so they swap straight to the image with no spinner flash;
// only genuinely slow/cold loads surface the spinner.
const SPINNER_DELAY_MS = 150;

type ProfileImageProps = {
  storage: FirebaseStorage;
  userID: string;
  downloadPath: string | null | undefined;
  style: StyleProp<ImageStyle>;
  refreshTrigger?: number; // Likely a number, used to force a refresh
  enlargable?: boolean;
};

type AvatarImageProps = {
  /** The resolved image URI, or `null` once we know there is no image to show. */
  uri: string | null;
  /** Whether the download URL is still being resolved. */
  isResolving: boolean;
  /** Whether the user is expected to have a photo (derived from `downloadPath`). */
  expectsPhoto: boolean;
  /** Tint applied to the fallback icon (undefined when a real photo is shown). */
  tintColor: string | undefined;
  style: StyleProp<ImageStyle>;
};

function AvatarImage({
  uri,
  isResolving,
  expectsPhoto,
  tintColor,
  style,
}: AvatarImageProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const [isLoaded, setIsLoaded] = useState(false);
  const [delayElapsed, setDelayElapsed] = useState(false);
  const [prevUri, setPrevUri] = useState(uri);

  // Reset the loaded flag when the source changes without remounting, so an
  // already-visible spinner stays put across the resolution -> download
  // transition instead of blinking off when the timer would otherwise restart.
  if (uri !== prevUri) {
    setPrevUri(uri);
    setIsLoaded(false);
  }

  // We are loading when the user has a photo that has neither resolved to "no
  // image" nor finished rendering yet. Cache hits flip `isLoaded` before the
  // delay below elapses, so the spinner never shows for them.
  const resolvedEmpty = !isResolving && !uri;
  const isLoading = expectsPhoto && !resolvedEmpty && !isLoaded;

  useEffect(() => {
    if (!isLoading) {
      return undefined;
    }
    const timer = setTimeout(() => setDelayElapsed(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <View style={[style as StyleProp<ViewStyle>, {overflow: 'hidden'}]}>
      <Image
        source={uri ? {uri} : KirokuIcons.UserIcon}
        placeholder={KirokuIcons.UserIcon}
        placeholderContentFit="cover"
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
        tintColor={tintColor}
        style={StyleSheet.absoluteFill}
        onLoad={uri ? () => setIsLoaded(true) : undefined}
      />
      {isLoading && delayElapsed && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.justifyContentCenter,
            styles.alignItemsCenter,
            {backgroundColor: theme.appBG},
          ]}>
          <FlexibleLoadingIndicator
            size={CONST.ACTIVITY_INDICATOR_SIZE.SMALL}
          />
        </View>
      )}
    </View>
  );
}

function ProfileImage({
  storage,
  userID,
  downloadPath,
  style,
  refreshTrigger,
  enlargable,
}: ProfileImageProps) {
  const theme = useTheme();
  // `undefined` while the download URL is being resolved, then `string | null`.
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(
    undefined,
  );

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

  const expectsPhoto =
    !!downloadPath &&
    (downloadPath.startsWith(CONST.LOCAL_IMAGE_PREFIX) ||
      downloadPath.includes(CONST.FIREBASE_STORAGE_URL));
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
    <AvatarImage
      uri={imageUrl ?? null}
      isResolving={imageUrl === undefined}
      expectsPhoto={expectsPhoto}
      tintColor={iconTint}
      style={style}
    />
  );
}

export default ProfileImage;
