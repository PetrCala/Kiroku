import React, {useEffect, useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Alert, View} from 'react-native';
import type IconAsset from '@src/types/utils/IconAsset';
import * as ErrorUtils from '@libs/ErrorUtils';
import {uploadImage} from '@userActions/Image';
import ERRORS from '@src/ERRORS';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import UploadImagePopup from './Popups/UploadImagePopup';
import Button from './Button';

const OUTPUT_WIDTH = 300;
const JPEG_QUALITY = 0.8;

type UploadImageComponentProps = {
  src: IconAsset;
  isProfilePicture: boolean;
  containerStyles?: StyleProp<ViewStyle>;
};

/**
 * Web sibling of UploadImage. Native picks through expo-image-picker and crops
 * with expo-image-manipulator behind OS permission prompts; neither module
 * exists on web. Here we pick via a `<input type="file">` and crop/resize on a
 * `<canvas>` to the same target ratio (1:1 for profile, 3:4 otherwise) and width
 * (300px JPEG). The result is fed into the same kiroku-api upload pipeline
 * (`uploadImage`), so the upload/finalize flow is byte-for-byte identical to
 * native from `uploadImage` onward.
 */

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(file);
  });
}

function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode selected image'));
    image.src = dataUrl;
  });
}

/**
 * Center-crop to the target aspect ratio, then resize to OUTPUT_WIDTH (height
 * derived proportionally), and encode as a JPEG object URL. Mirrors the native
 * crop-then-resize math so the output is never stretched.
 */
async function processImage(
  file: File,
  isProfilePicture: boolean,
): Promise<string> {
  const dataUrl = await readFileAsDataURL(file);
  const image = await decodeImage(dataUrl);

  const srcWidth = image.naturalWidth;
  const srcHeight = image.naturalHeight;
  const [ratioW, ratioH] = isProfilePicture ? [1, 1] : [3, 4];
  const targetRatio = ratioW / ratioH;
  const srcRatio = srcWidth / srcHeight;

  let originX = 0;
  let originY = 0;
  let cropWidth = srcWidth;
  let cropHeight = srcHeight;

  if (srcRatio > targetRatio) {
    cropWidth = Math.round(srcHeight * targetRatio);
    originX = Math.round((srcWidth - cropWidth) / 2);
  } else if (srcRatio < targetRatio) {
    cropHeight = Math.round(srcWidth / targetRatio);
    originY = Math.round((srcHeight - cropHeight) / 2);
  }

  const outputHeight = Math.max(
    1,
    Math.round((cropHeight / cropWidth) * OUTPUT_WIDTH),
  );

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_WIDTH;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  context.drawImage(
    image,
    originX,
    originY,
    cropWidth,
    cropHeight,
    0,
    0,
    OUTPUT_WIDTH,
    outputHeight,
  );

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });
  if (!blob) {
    throw new Error('Failed to encode resized image');
  }
  return URL.createObjectURL(blob);
}

function UploadImageComponent({
  src,
  isProfilePicture = false,
  containerStyles,
}: UploadImageComponentProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {isOffline} = useNetwork();
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadOngoing, setUploadOngoing] = useState(false);

  const resetIndicators = () => {
    setUploadOngoing(false);
    setUploadProgress(null);
  };

  const chooseImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // No `change` event fires when the user cancels the native file dialog, so
    // a cancellation is simply a silent no-op (no upload is triggered).
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      processImage(file, isProfilePicture)
        .then(uri => setImageSource(uri)) // Triggers upload
        .catch(error =>
          ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.CHOICE_FAILED, error),
        );
    };
    input.click();
  };

  const handleChooseImagePress = () => {
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
    // No OS permission step on web — the file picker prompts the user itself.
    resetIndicators();
    chooseImage();
  };

  useEffect(() => {
    const handleUpload = async (sourceURI: string | null) => {
      if (!sourceURI) {
        return;
      }

      setUploadModalVisible(true);
      setUploadOngoing(true);
      try {
        await uploadImage('avatar', sourceURI, setUploadProgress);
      } catch (error) {
        setImageSource(null);
        ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.UPLOAD_FAILED, error);
        setUploadModalVisible(false);
      }
      setUploadOngoing(false);
      // The object URL was only needed to read the bytes for the upload;
      // release it once the upload settles (success or error) to avoid leaking
      // blobs. A `finally` block would do this more tidily, but the React
      // Compiler can't yet lower try/finally, so we fall through instead.
      if (sourceURI.startsWith('blob:')) {
        URL.revokeObjectURL(sourceURI);
      }
    };

    handleUpload(imageSource);
  }, [imageSource]);

  return (
    <View
      style={[
        styles.alignItemsCenter,
        styles.justifyContentCenter,
        containerStyles,
      ]}>
      <Button
        onPress={handleChooseImagePress}
        icon={src}
        style={[styles.border, styles.borderRadiusNormal, styles.appBG]}
      />

      {imageSource && (
        <UploadImagePopup
          visible={uploadModalVisible}
          onRequestClose={() => setUploadModalVisible(false)}
          uploadProgress={uploadProgress}
          uploadOngoing={uploadOngoing}
          onUploadFinish={() => setUploadOngoing(false)}
        />
      )}
    </View>
  );
}

export default UploadImageComponent;
