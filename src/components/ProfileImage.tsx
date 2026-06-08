import React, {useState} from 'react';
import type {
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import CONST from '@src/CONST';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as KirokuIcons from './Icon/KirokuIcons';
import FlexibleLoadingIndicator from './FlexibleLoadingIndicator';
import EnlargableImage from './Buttons/EnlargableImage';

type ProfileImageProps = {
  /**
   * The user's profile photo URL (`profile.photo_url`), or empty/undefined when
   * there is no photo. New avatars store a public bucket URL (set server-side by
   * the image-pipeline finalize step); legacy avatars store a token-based
   * Firebase download URL. Both load as-is.
   */
  photoUrl: string | null | undefined;
  style: StyleProp<ImageStyle>;
  enlargable?: boolean;
};

type AvatarImageProps = {
  /** The image URI to render, or empty/`null`/`undefined` when there is no photo. */
  uri: string | null | undefined;
  /** Tint applied to the fallback icon (undefined when a real photo is shown). */
  tintColor: string | undefined;
  style: StyleProp<ImageStyle>;
};

function AvatarImage({uri, tintColor, style}: AvatarImageProps) {
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

  // Show the spinner while a real photo is still loading. The opaque overlay
  // below covers the fallback icon until the image is ready.
  const isLoading = !!uri && !isLoaded;

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

function ProfileImage({photoUrl, style, enlargable}: ProfileImageProps) {
  const theme = useTheme();
  // Render the stored profile photo URL directly (an empty/missing value falls
  // back to the placeholder icon via the truthy checks below). Image caching is
  // delegated to expo-image's `cachePolicy`, so no client-side resolution layer
  // is needed.
  const iconTint = photoUrl ? undefined : theme.icon;

  const avatar = (
    <AvatarImage uri={photoUrl} tintColor={iconTint} style={style} />
  );

  if (enlargable) {
    const imageSource: ImageSourcePropType = photoUrl
      ? {uri: photoUrl}
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
