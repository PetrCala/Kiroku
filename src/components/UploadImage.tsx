import React, {useEffect, useState} from 'react';
import type {ImageSourcePropType, StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type {ImagePickerAsset} from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import checkPermission from '@libs/Permissions/checkPermission';
import requestPermission from '@libs/Permissions/requestPermission';
import * as Profile from '@userActions/Profile';
import * as ErrorUtils from '@libs/ErrorUtils';
import {useFirebase} from '@src/context/global/FirebaseContext';
import uploadImageToFirebase from '@src/storage/storageUpload';
import ERRORS from '@src/ERRORS';
import useThemeStyles from '@hooks/useThemeStyles';
import UploadImagePopup from './Popups/UploadImagePopup';
import Button from './Button';

type UploadImageComponentProps = {
  pathToUpload: string;
  src: ImageSourcePropType;
  isProfilePicture: boolean;
  containerStyles?: StyleProp<ViewStyle>;
};

function UploadImageComponent({
  pathToUpload,
  src,
  isProfilePicture = false,
  containerStyles,
}: UploadImageComponentProps) {
  const {auth, db, storage} = useFirebase();
  const styles = useThemeStyles();
  const user = auth.currentUser;
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadOngoing, setUploadOngoing] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [warning, setWarning] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [success, setSuccess] = useState('');

  const chooseImage = async (): Promise<void> => {
    try {
      // Launch image picker
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result =
        await // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        (ImagePicker as unknown as typeof ImagePicker).launchImageLibraryAsync({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          mediaTypes:
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (ImagePicker as unknown as typeof ImagePicker).MediaTypeOptions
              .Images,
          allowsEditing: true,
          aspect: isProfilePicture ? [1, 1] : [3, 4], // Square for profile, 3:4 for others
          quality: 0.8,
        });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return; // User cancelled or no assets
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const selectedImage: ImagePickerAsset = result.assets[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const {uri: imageUri, width: srcWidth, height: srcHeight} = selectedImage;
      if (!imageUri || typeof imageUri !== 'string') {
        ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.FETCH_FAILED);
        return;
      }

      // Compute a center-crop rectangle that matches the target aspect ratio.
      // This is necessary because Android's native crop intent (used by allowsEditing)
      // does not reliably enforce the aspect constraint — the picker may return an image
      // with arbitrary dimensions. Cropping in ImageManipulator before resizing ensures
      // the output is never stretched regardless of platform behaviour.
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

      // Crop to the exact target ratio first, then resize with only width so
      // ImageManipulator infers height proportionally — distortion is impossible.
      const manipulatorActions: ImageManipulator.Action[] = [
        {crop: {originX, originY, width: cropWidth, height: cropHeight}},
        {resize: {width: 300}},
      ];

      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        manipulatorActions,
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const manipulatedUri = manipulatedImage?.uri;
      if (!manipulatedUri || typeof manipulatedUri !== 'string') {
        ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.FETCH_FAILED);
        return;
      }

      setImageSource(manipulatedUri); // Triggers upload
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // TODO add clever error handling
      if (
        errorMessage.includes('cancel') ||
        errorMessage.includes('cancelled')
      ) {
        return;
      }
      ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.CHOICE_FAILED, error);
    }
  };

  const resetIndicators = () => {
    setUploadOngoing(false);
    setUploadProgress(null);
    setWarning('');
    setSuccess('');
  };

  const handleChooseImagePress = async () => {
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
      await chooseImage(); // Call automatically
    } catch (error) {
      ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.CHOICE_FAILED, error);
    }
  };

  useEffect(() => {
    const handleUpload = async (sourceURI: string | null) => {
      if (!sourceURI) {
        return;
      }

      try {
        setUploadModalVisible(true);
        setUploadOngoing(true);
        await uploadImageToFirebase(
          storage,
          sourceURI,
          pathToUpload,
          setUploadProgress,
          setSuccess,
        ); // Wait for the promise to resolve
        if (isProfilePicture) {
          await Profile.updateProfileInfo(
            pathToUpload,
            user,
            auth,
            db,
            storage,
          );
        }
      } catch (error) {
        setImageSource(null);
        ErrorUtils.raiseAppError(ERRORS.IMAGE_UPLOAD.UPLOAD_FAILED, error);
        setUploadModalVisible(false);
      } finally {
        setUploadOngoing(false); // Otherwise set upon success in child component
      }
    };

    handleUpload(imageSource);
  }, [auth, db, isProfilePicture, storage, user, pathToUpload, imageSource]);

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
