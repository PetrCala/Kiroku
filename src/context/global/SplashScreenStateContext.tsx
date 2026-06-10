import React, {useCallback, useContext, useMemo, useRef, useState} from 'react';
import type {ValueOf} from 'type-fest';
import CONST from '@src/CONST';
import type ChildrenProps from '@src/types/utils/ChildrenProps';

/**
 * On-screen rectangle (window coordinates) of the InitialScreen logo slot.
 * Reported by the animated KirokuLogo so the native boot-splash hider can fly
 * its logo into that exact spot on a signed-out cold boot. See
 * SplashScreenHider/index.native.tsx and KirokuLogo/index.tsx.
 */
type LogoHandoffTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SplashScreenStateContextType = {
  splashScreenState: ValueOf<typeof CONST.BOOT_SPLASH_STATE>;
  setSplashScreenState: React.Dispatch<
    React.SetStateAction<ValueOf<typeof CONST.BOOT_SPLASH_STATE>>
  >;
  /**
   * True once the authenticated subtree has hydrated the user's data
   * (userData + preferences). Set from inside AuthScreens and consumed by
   * Kiroku.tsx as one of the splash-hide preconditions for authenticated
   * users. Has no meaning for
   * the unauthenticated path — Kiroku gates on isAuthenticated separately.
   */
  isAuthDataReady: boolean;
  setIsAuthDataReady: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * Read side of the splash → InitialScreen logo handoff channel. The native
   * splash hider reads `.current` once, at hide time, to decide whether to fly
   * the splash logo into the slot. A ref (not state) so the frequent layout
   * writes that feed it never re-render the boot tree. Write via
   * `reportLogoHandoffTarget`.
   */
  logoHandoffTargetRef: React.MutableRefObject<LogoHandoffTargetRect | null>;
  /**
   * Write side of that channel. The animated logo reports its measured window
   * rect on layout (and null on unmount). A stable callback that mutates the
   * provider-owned ref, so consumers never touch the ref directly.
   */
  reportLogoHandoffTarget: (rect: LogoHandoffTargetRect | null) => void;
  /**
   * True only while the splash hider is performing the handoff. The animated
   * logo reads this to render already-settled underneath the flying splash
   * logo (skipping its assembly entrance, which the splash stands in for).
   * Stays false on every non-handoff path (authenticated boot, logout remount,
   * reduced motion) so the entrance plays as usual.
   */
  isLogoHandoffActive: boolean;
  setIsLogoHandoffActive: React.Dispatch<React.SetStateAction<boolean>>;
};

const SplashScreenStateContext =
  React.createContext<SplashScreenStateContextType>({
    splashScreenState: CONST.BOOT_SPLASH_STATE.VISIBLE,
    setSplashScreenState: () => {},
    isAuthDataReady: false,
    setIsAuthDataReady: () => {},
    logoHandoffTargetRef: {current: null},
    reportLogoHandoffTarget: () => {},
    isLogoHandoffActive: false,
    setIsLogoHandoffActive: () => {},
  });

function SplashScreenStateContextProvider({children}: ChildrenProps) {
  const [splashScreenState, setSplashScreenState] = useState<
    ValueOf<typeof CONST.BOOT_SPLASH_STATE>
  >(CONST.BOOT_SPLASH_STATE.VISIBLE);
  const [isAuthDataReady, setIsAuthDataReady] = useState(false);
  const [isLogoHandoffActive, setIsLogoHandoffActive] = useState(false);
  const logoHandoffTargetRef = useRef<LogoHandoffTargetRect | null>(null);
  const reportLogoHandoffTarget = useCallback(
    (rect: LogoHandoffTargetRect | null) => {
      logoHandoffTargetRef.current = rect;
    },
    [],
  );
  const splashScreenStateContext = useMemo(
    () => ({
      splashScreenState,
      setSplashScreenState,
      isAuthDataReady,
      setIsAuthDataReady,
      logoHandoffTargetRef,
      reportLogoHandoffTarget,
      isLogoHandoffActive,
      setIsLogoHandoffActive,
    }),
    [
      splashScreenState,
      isAuthDataReady,
      isLogoHandoffActive,
      reportLogoHandoffTarget,
    ],
  );

  return (
    <SplashScreenStateContext.Provider value={splashScreenStateContext}>
      {children}
    </SplashScreenStateContext.Provider>
  );
}

function useSplashScreenStateContext() {
  return useContext(SplashScreenStateContext);
}

export default SplashScreenStateContext;
export type {LogoHandoffTargetRect};
export {SplashScreenStateContextProvider, useSplashScreenStateContext};
