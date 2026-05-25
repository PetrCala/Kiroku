import type {Permission, PermissionStatus} from 'react-native';
import type {
  Permission as RNPermission,
  PermissionStatus as RNPermissionStatus,
  NotificationsResponse,
} from 'react-native-permissions';
import type Platform from '@libs/getPlatform/types';

type PermissionKey =
  | 'camera'
  | 'location'
  | 'notifications'
  | 'read_photos'
  | 'write_photos';

type PermissionValue = Permission | RNPermission;

type PermissionEntry = Partial<Record<Platform, PermissionValue>>;

type GeneralPermissionStatus =
  | PermissionStatus
  | RNPermissionStatus
  | NotificationsResponse;

export type {
  GeneralPermissionStatus,
  PermissionEntry,
  PermissionValue,
  PermissionKey,
};
