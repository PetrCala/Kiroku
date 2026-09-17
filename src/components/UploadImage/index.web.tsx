import React, {useState} from 'react';
import {Alert, View} from 'react-native';
import Button from '@components/Button';
import UploadImagePopup from '@components/Popups/UploadImagePopup';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import {uploadImage} from '@userActions/Image';
import CONST from '@src/CONST';
import ERRORS from '@src/ERRORS';
import {getCropRect, getImageProfile, getOutputSize} from './imageProfile';
import type UploadImageProps from './types';

/**
 * Web sibling of UploadImage. Native picks through expo-image-picker and crops
 * with expo-image-manipulator behind OS permission prompts; neither module
 * exists on web. Here we pick via a `<input type="file">` and crop/resize on a
 * `<canvas>` to the same per-kind profile (`imageProfile.ts`), so the two
 * platforms produce the same bytes and the same reported dimensions. The result
 * is fed into the same kiroku-api upload pipeline (`uploadImage`), so the
 * upload/finalize flow is byte-for-byte identical to native from `uploadImage`
 * onward.
 */

/** A prepared image: the object url to upload plus the size it actually is. */
type PreparedImage = {uri: string; width: number; height: number};

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
 * Center-crop to the kind's target ratio (or keep the source framing), resize
 * to its output width, and encode as a JPEG object URL. Mirrors the native
 * crop-then-resize math through the same helpers, so the output is never
 * stretched and both platforms report the same `w`/`h`.
 */
async function processImage(
  file: File,
  kind: UploadImageProps['kind'],
): Promise<PreparedImage> {
  const profile = getImageProfile(kind);
  const dataUrl = await readFileAsDataURL(file);
  const image = await decodeImage(dataUrl);

  const crop = getCropRect(
    image.naturalWidth,
    image.naturalHeight,
    profile.aspectRatio,
  );
  const output = getOutputSize(crop.width, crop.height, profile.outputWidth);

  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  context.drawImage(
    image,
    crop.originX,
    crop.originY,
    crop.width,
    crop.height,
    0,
    0,
    output.width,
    output.height,
  );

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', profile.quality);
  });
  if (!blob) {
    throw new Error('Failed to encode resized image');
  }
  return {
    uri: URL.createObjectURL(blob),
    width: output.width,
    height: output.height,
  };
}

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
   * Prepare the picked file and upload it. Driven straight from the picker
   * rather than from an effect on the prepared image: the upload must run
   * exactly once per pick, and an effect would have to close over every prop
   * the upload needs while depending on none of them.
   */
  const prepareAndUpload = async (file: File) => {
    const image = await processImage(file, kind);
    setPreparedImage(image);
    if (shouldShowUploadPopup) {
      setUploadModalVisible(true);
    }
    setUploadOngoing(true);
    onUploadingChange?.(true);
    try {
      await uploadImage(kind, image.uri, setUploadProgress, {
        sessionId,
        width: image.width,
        height: image.height,
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
    // The object URL was only needed to read the bytes for the upload; release
    // it once the upload settles (success or error) to avoid leaking blobs. A
    // `finally` block would do this more tidily, but the React Compiler can't
    // yet lower try/finally, so we fall through instead.
    if (image.uri.startsWith('blob:')) {
      URL.revokeObjectURL(image.uri);
    }
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
      prepareAndUpload(file).catch(error =>
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
    // No OS permission step on web: the file picker prompts the user itself.
    resetIndicators();
    chooseImage();
  };

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
