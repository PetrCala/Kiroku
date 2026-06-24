import {useCallback, useEffect, useRef} from 'react';
import BootSplash from '@libs/BootSplash';
import Log from '@libs/Log';
import CONST from '@src/CONST';
import type {
  SplashScreenHiderProps,
  SplashScreenHiderReturnType,
} from './types';

// Mirror of the native hider's safety net: force-hide the splash if
// shouldHideSplash hasn't fired by this point. On web this matters doubly --
// the #splash div sits at z-index 10000 and swallows every pointer event, so a
// gating condition that never flips leaves the app visible but untappable.
//
// This is the LAST resort, not the primary fix: the authenticated splash gate
// (`isAuthDataReady`) has its own bounded backstop in Kiroku.tsx, so a healthy
// boot resolves well before this fires. Kiroku.tsx logs the full gate snapshot
// one tick before this (the "[BootSplash] splash screen is still visible"
// alert), so a trip here always has an accompanying breadcrumb of the offender.
const FORCE_HIDE_TIMEOUT_MS = CONST.BOOT_SPLASH_FORCE_HIDE_TIMEOUT_MS;

// Floor for how long the splash stays up, so a fast boot can't flash it for a
// couple of frames. See CONST for the rationale. Mirrors the native hider.
const MIN_VISIBLE_DURATION_MS = CONST.BOOT_SPLASH_MIN_VISIBLE_DURATION_MS;

// Captured once when this module is first evaluated, during the initial bundle
// load — the closest JS-side proxy for "splash became visible". A slight
// underestimate (the #splash div is painted before the bundle runs), which only
// ever makes the enforced minimum more conservative, never less.
const SPLASH_VISIBLE_SINCE = Date.now();

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

    // Enforce a minimum on-screen duration: if the splash has been up for less
    // than the floor when it's ready to hide, defer the hide for the remainder
    // so a fast boot reads as an intentional beat rather than a flicker. The
    // 15s force-hide net sits far above this, so the two never collide.
    const runHide = () => {
      BootSplash.hide().then(() => onHide());
    };
    const remainingMs =
      MIN_VISIBLE_DURATION_MS - (Date.now() - SPLASH_VISIBLE_SINCE);
    if (remainingMs > 0) {
      setTimeout(runHide, remainingMs);
    } else {
      runHide();
    }
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
