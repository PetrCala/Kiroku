import {useEffect, useRef} from 'react';
import BootSplash from '@libs/BootSplash';
import type {
  SplashScreenHiderProps,
  SplashScreenHiderReturnType,
} from './types';

function SplashScreenHider({
  onHide = () => {},
  isVisible = true,
}: SplashScreenHiderProps): SplashScreenHiderReturnType {
  const hideHasBeenCalled = useRef(false);

  useEffect(() => {
    // Only hide when isVisible becomes false and hide hasn't been called yet
    if (isVisible || hideHasBeenCalled.current) {
      return;
    }
    hideHasBeenCalled.current = true;
    BootSplash.hide().then(() => onHide());
  }, [isVisible, onHide]);

  return null;
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
