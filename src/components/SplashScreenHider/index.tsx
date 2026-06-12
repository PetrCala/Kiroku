import {useCallback, useEffect, useRef} from 'react';
import BootSplash from '@libs/BootSplash';
import Log from '@libs/Log';
import type {
  SplashScreenHiderProps,
  SplashScreenHiderReturnType,
} from './types';

// Mirror of the native hider's safety net: force-hide the splash if
// shouldHideSplash hasn't fired by this point. On web this matters doubly --
// the #splash div sits at z-index 10000 and swallows every pointer event, so a
// gating condition that never flips leaves the app visible but untappable.
const FORCE_HIDE_TIMEOUT_MS = 15 * 1000;

function SplashScreenHider({
  onHide = () => {},
  shouldHideSplash,
}: SplashScreenHiderProps): SplashScreenHiderReturnType {
  const hideHasBeenCalled = useRef(false);

  const hide = useCallback(() => {
    if (hideHasBeenCalled.current) {
      return;
    }
    hideHasBeenCalled.current = true;
    BootSplash.hide().then(() => onHide());
  }, [onHide]);

  useEffect(() => {
    if (!shouldHideSplash) {
      return;
    }
    hide();
  }, [shouldHideSplash, hide]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (hideHasBeenCalled.current) {
        return;
      }
      Log.alert(
        '[BootSplash] shouldHideSplash never became true, force-hiding splash',
        {timeoutMs: FORCE_HIDE_TIMEOUT_MS},
        false,
      );
      hide();
    }, FORCE_HIDE_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [hide]);

  return null;
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
