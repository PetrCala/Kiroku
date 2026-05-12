import {useEffect, useRef} from 'react';
import BootSplash from '@libs/BootSplash';
import type {
  SplashScreenHiderProps,
  SplashScreenHiderReturnType,
} from './types';

function SplashScreenHider({
  onHide = () => {},
  shouldHideSplash,
}: SplashScreenHiderProps): SplashScreenHiderReturnType {
  const hideHasBeenCalled = useRef(false);

  useEffect(() => {
    if (!shouldHideSplash || hideHasBeenCalled.current) {
      return;
    }
    hideHasBeenCalled.current = true;
    BootSplash.hide().then(() => onHide());
  }, [shouldHideSplash, onHide]);

  return null;
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
