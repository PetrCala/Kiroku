import {NativeModules} from 'react-native';
import Log from '@libs/Log';

const BootSplash = NativeModules.BootSplash;

function hide(): Promise<void> {
  Log.info('[BootSplash] hiding splash screen', false);
  return BootSplash.hide();
}

export default {
  hide,
  getVisibilityStatus: BootSplash.getVisibilityStatus,
};
