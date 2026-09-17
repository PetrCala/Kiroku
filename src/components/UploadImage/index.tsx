import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type {ImagePickerAsset} from 'expo-image-picker';
import React, {useState} from 'react';
import {Alert, View} from 'react-native';
import Button from '@components/Button';
import UploadImagePopup from '@components/Popups/UploadImagePopup';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import checkPermission from '@libs/Permissions/checkPermission';
import requestPermission from '@libs/Permissions/requestPermission';
import {uploadImage} from '@userActions/Image';
import CONST from '@src/CONST';
import ERRORS from '@src/ERRORS';
import {getCropRect, getImageProfile, getOutputSize} from './imageProfile';
import type UploadImageProps from './types';

/**
 * The asset the user picked, or `null` when they cancelled or the picker
 * returned nothing. Lives at module scope on purpose: the narrowing it does
 * (`canceled`, then the first asset) is a value expression, which the React
 * Compiler cannot lower inside the try block that wraps the picker call.
 */
function getPickedAsset(
  result: ImagePicker.ImagePickerResult,
): ImagePickerAsset | null {
  if (result.canceled) {
    return null;
  }
  return result.assets?.[0] ?? null;
}

/** The asset's local uri, or `null` when it has none. Module scope, as above. */
function getAssetUri(asset: ImagePickerAsset): string | null {
  if (typeof asset.uri !== 'string') {
    return null;
  }
  if (asset.uri === '') {
    return null;
  }
  return asset.uri;
}

/**
 * A prepared image: the local uri to upload, the size the manipulator reported
 * for it, and the computed size to fall back to when it reported none.
 */
type PreparedImage = {
  uri: string;
  width?: number;
  height?: number;
  fallbackWidth: number;
  fallbackHeight: number;
};

function UploadImageComponent({
  src,
  kind,
  sessionId,
  containerStyles,
  buttonStyles,
  text,
  onUploadSuccess,
  isDisabled,
  shouldShowUploadPopup = true,
  onUploadingChange,
  testID,
}: UploadImageProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {isOffline} = useNetwork();
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(
    null,
  );
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadOngoing, setUploadOngoing] = useState(false);

  const resetIndicators = () => {
    setUploadOngoing(false);
    setUploadProgress(null);
  };

  /**
   * Upload a prepared image. Called straight from the picker rather than from
   * an effect on the prepared image: the upload must run exactly once per pick,
   * and an effect would have to close over every prop the upload needs while
   * depending on none of them.
   */
  const upload = async (image: PreparedImage) => {
    // Resolved before the try below, which must hold no value expressions.
    const width = image.width ?? image.fallbackWidth;
    const height = image.height ?? image.fallbackHeight;
    setPreparedImage(image);
    if (shouldShowUploadPopup) {
      setUploadModalVisible(true);
    }
    setUploadOngoing(true);
    onUploadingChange?.(true);
    try {
      // Upload through the kiroku-api image pipeline (XHR PUT drives the
      // progress bar). The server persists the result in its finalize step and
      // its onyxData updates Onyx: the avatar's `profile.photo_url`, or the
      // photo on the session. The client never derives either.
      await uploadImage(kind, image.uri, setUploadProgress, {
        sessionId,
        width,
        height,
      });
      // A plain call, not `onUploadSuccess?.()`: the React Compiler rejects
      // value expressions (including optional calls) inside a try block.
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      setPreparedImage(null);
      ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.UPLOAD_FAILED, error);
      setUploadModalVisible(false);
    }
    setUploadOngoing(false);
    onUploadingChange?.(false);
  };

  const chooseImage = async (): Promise<PreparedImage | null> => {
    const profile = getImageProfile(kind);
    // Built outside the try/catch: the React Compiler rejects value
    // expressions (logical/ternary) inside a try block. A fixed-ratio kind
    // hands the user the OS cropper; a kind that keeps the source framing (a
    // session photo) skips it, so the photo arrives as it was shot.
    const aspect: [number, number] | undefined = profile.aspectRatio
      ? [profile.aspectRatio[0], profile.aspectRatio[1]]
      : undefined;
    const allowsEditing = !!profile.aspectRatio;
    try {
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality: 0.8,
      });

      const selectedImage = getPickedAsset(result);
      if (selectedImage === null) {
        return null; // User cancelled or no assets
      }

      const imageUri = getAssetUri(selectedImage);
      if (imageUri === null) {
        ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.FETCH_FAILED);
        return null;
      }
      const srcWidth = selectedImage.width;
      const srcHeight = selectedImage.height;

      // Crop to the kind's target ratio first (Android's native crop intent
      // does not reliably enforce it, so the picker may return arbitrary
      // dimensions), then resize with only width so ImageManipulator infers
      // height proportionally. Distortion is impossible either way.
      const crop = getCropRect(srcWidth, srcHeight, profile.aspectRatio);
      const output = getOutputSize(
        crop.width,
        crop.height,
        profile.outputWidth,
      );
      const manipulatorActions: ImageManipulator.Action[] = [
        {crop},
        {resize: {width: output.width}},
      ];

      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        manipulatorActions,
        {
          compress: profile.quality,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const manipulatedUri = manipulatedImage.uri;
      if (manipulatedUri === '') {
        ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.FETCH_FAILED);
        return null;
      }

      // The manipulator reports what the bytes actually are, which is what a
      // session photo's `w`/`h` has to be (every reader lays out against it).
      // `getOutputSize` is the fallback for a platform that omits them.
      return {
        uri: manipulatedUri,
        width: manipulatedImage.width,
        height: manipulatedImage.height,
        fallbackWidth: output.width,
        fallbackHeight: output.height,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // TODO add clever error handling
      if (
        errorMessage.includes('cancel') ||
        errorMessage.includes('cancelled')
      ) {
        return null;
      }
      ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.CHOICE_FAILED, error);
    }
    return null;
  };

  const handleChooseImagePress = async () => {
    // The image upload goes straight to the bucket, which the offline request
    // queue can't defer or replay. Guard up front rather than letting the user
    // pick an image and watch the upload fail.
    if (isOffline) {
      Alert.alert(
        translate('common.youAppearToBeOffline'),
        translate('common.thisFeatureRequiresInternet'),
      );
      return;
    }
    try {
      // Check for permissions
      const permissionAllowed = await checkPermission('read_photos');
      if (!permissionAllowed) {
        const permissionGranted = await requestPermission('read_photos');
        if (!permissionGranted) {
          return; // Permission denied - info message automatically handled by requestPermission
        }
      }
      resetIndicators(); // Clean the indicators for upload
      const prepared = await chooseImage();
      if (!prepared) {
        return; // Cancelled, or already reported
      }
      await upload(prepared);
    } catch (error) {
      ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.CHOICE_FAILED, error);
    }
  };

  return (
    <View
      style={[
        styles.alignItemsCenter,
        styles.justifyContentCenter,
        containerStyles,
      ]}>
      <Button
        onPress={() => {
          handleChooseImagePress().catch(() => {
            // Error already handled in handleChooseImagePress
          });
        }}
        icon={src}
        text={text}
        isDisabled={isDisabled}
        testID={testID}
        accessibilityLabel={translate(
          kind === CONST.IMAGE_UPLOAD_KIND.SESSION
            ? 'sessionPhotos.addPhoto'
            : 'imageUpload.chooseProfilePicture',
        )}
        style={[
          styles.border,
          styles.borderRadiusNormal,
          styles.appBG,
          buttonStyles,
        ]}
      />

      {preparedImage && shouldShowUploadPopup ? (
        <UploadImagePopup
          visible={uploadModalVisible}
          onRequestClose={() => setUploadModalVisible(false)}
          uploadProgress={uploadProgress}
          uploadOngoing={uploadOngoing}
          onUploadFinish={() => setUploadOngoing(false)}
        />
      ) : null}
    </View>
  );
}

export default UploadImageComponent;
