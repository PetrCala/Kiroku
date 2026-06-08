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
import Log from '@libs/Log';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as KirokuIcons from './Icon/KirokuIcons';
import FlexibleLoadingIndicator from './FlexibleLoadingIndicator';
import EnlargableImage from './Buttons/EnlargableImage';

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
  const [prevUri, setPrevUri] = useState(uri);

  // Reset the loaded flag when the source changes without remounting, so the
  // spinner reappears for the new image (e.g. after a profile-picture update).
  if (uri !== prevUri) {
    setPrevUri(uri);
    setIsLoaded(false);
  }

  // We are loading when the user has a photo that has neither resolved to "no
  // image" nor finished rendering yet. The opaque spinner overlay below covers
  // the fallback icon while loading, so the user sees the spinner (not the "no
  // photo" silhouette) until the real image is ready.
  const resolvedEmpty = !isResolving && !uri;
  const isLoading = expectsPhoto && !resolvedEmpty && !isLoaded;

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
      {isLoading && (
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

  // Bumped on reconnect to re-resolve avatars that failed to download while
  // offline, mirroring `Avatar`'s `useNetwork` retry. We keep the current
  // placeholder visible during the retry instead of flashing a spinner.
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  useNetwork({onReconnect: () => setReconnectTrigger(prev => prev + 1)});

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
          // A background avatar download can fail for benign reasons (offline,
          // flaky network). Degrade silently to the placeholder instead of
          // raising a blocking, stackable app-error alert; the `useNetwork`
          // retry above re-resolves the real avatar once back online.
          Log.warn('Failed to resolve profile picture URL', {error});
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
  }, [storage, userID, downloadPath, refreshTrigger, reconnectTrigger]);

  const expectsPhoto =
    !!downloadPath &&
    (downloadPath.startsWith(CONST.LOCAL_IMAGE_PREFIX) ||
      downloadPath.includes(CONST.FIREBASE_STORAGE_URL));
  const iconTint = imageUrl ? undefined : theme.icon;

  const avatar = (
    <AvatarImage
      uri={imageUrl ?? null}
      isResolving={imageUrl === undefined}
      expectsPhoto={expectsPhoto}
      tintColor={iconTint}
      style={style}
    />
  );

  if (enlargable) {
    const imageSource: ImageSourcePropType = imageUrl
      ? {uri: imageUrl}
      : KirokuIcons.UserIcon;
    return (
      <EnlargableImage
        imageSource={imageSource}
        imageStyle={[style, {tintColor: iconTint}]}>
        {avatar}
      </EnlargableImage>
    );
  }

  return avatar;
}

export default ProfileImage;
