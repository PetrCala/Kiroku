import type {StyleProp, ViewStyle} from 'react-native';
import type {ImageUploadKind} from '@libs/API/parameters';
import type {DrinkingSessionId} from '@src/types/onyx';
import type IconAsset from '@src/types/utils/IconAsset';

/**
 * Props shared by the native and web pickers. `kind` picks both how the image
 * is prepared (`CONST.IMAGE_UPLOAD_PROFILE`) and what the server does with it:
 * an avatar is cropped square and published public-read, a session photo keeps
 * its framing and stays private.
 */
type UploadImageProps = {
  /** Icon on the button that opens the picker. */
  src: IconAsset;

  /** What the image is for. */
  kind: ImageUploadKind;

  /** The session to attach the photo to. Required for `kind: 'session'`. */
  sessionId?: DrinkingSessionId;

  /** Extra styles for the wrapper. */
  containerStyles?: StyleProp<ViewStyle>;

  /** Extra styles for the button itself. */
  buttonStyles?: StyleProp<ViewStyle>;

  /** Text beside the icon, when the button should read as an action. */
  text?: string;

  /** Runs once an upload finishes successfully. */
  onUploadSuccess?: () => void;

  /** Whether the picker is available. A session at the photo cap disables it. */
  isDisabled?: boolean;

  /**
   * Suppress the "uploading" popup and report progress to the caller instead.
   * The session gallery shows its own pending tile rather than a modal, which
   * is how an in-flight upload reads as pending state on the session.
   */
  shouldShowUploadPopup?: boolean;

  /** Called with `true` while an upload is in flight, when the popup is off. */
  onUploadingChange?: (isUploading: boolean) => void;

  /** Test handle for the picker button. */
  testID?: string;
};

export default UploadImageProps;
