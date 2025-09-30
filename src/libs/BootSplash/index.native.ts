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
  logoSizeRatio: BootSplash.logoSizeRatio || 1,
  logoWidth: BootSplash.logoWidth || 100,
  logoHeight: BootSplash.logoHeight || 100,
  navigationBarHeight: BootSplash.navigationBarHeight || 0,
};
