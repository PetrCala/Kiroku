import {PERMISSIONS} from 'react-native-permissions';
import type {PermissionEntry, PermissionKey} from './types';

const PermissionsMap: Record<PermissionKey, PermissionEntry> = {
  camera: {
    iOS: PERMISSIONS.IOS.CAMERA,
    Android: PERMISSIONS.ANDROID.CAMERA,
  },
  read_photos: {
    iOS: PERMISSIONS.IOS.PHOTO_LIBRARY,
    Android: PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
  },
  write_photos: {
    iOS: PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY,
    Android: PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
  },
  notifications: {
    iOS: undefined, // Handle through the checkNotifications, requestNotifications functions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    Android: PERMISSIONS.ANDROID.POST_NOTIFICATIONS,
  },
};

export default PermissionsMap;
