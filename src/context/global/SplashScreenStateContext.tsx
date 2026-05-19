import React, {useContext, useMemo, useState} from 'react';
import type {ValueOf} from 'type-fest';
import CONST from '@src/CONST';
import type ChildrenProps from '@src/types/utils/ChildrenProps';

type SplashScreenStateContextType = {
  splashScreenState: ValueOf<typeof CONST.BOOT_SPLASH_STATE>;
  setSplashScreenState: React.Dispatch<
    React.SetStateAction<ValueOf<typeof CONST.BOOT_SPLASH_STATE>>
  >;
  /**
   * True once the authenticated subtree has hydrated the user's RTDB data
   * (userData + preferences). Set from inside AuthScreens (which lives
   * below DatabaseDataProvider) and consumed by Kiroku.tsx as one of the
   * splash-hide preconditions for authenticated users. Has no meaning for
   * the unauthenticated path — Kiroku gates on isAuthenticated separately.
   */
  isAuthDataReady: boolean;
  setIsAuthDataReady: React.Dispatch<React.SetStateAction<boolean>>;
};

const SplashScreenStateContext =
  React.createContext<SplashScreenStateContextType>({
    splashScreenState: CONST.BOOT_SPLASH_STATE.VISIBLE,
    setSplashScreenState: () => {},
    isAuthDataReady: false,
    setIsAuthDataReady: () => {},
  });

function SplashScreenStateContextProvider({children}: ChildrenProps) {
  const [splashScreenState, setSplashScreenState] = useState<
    ValueOf<typeof CONST.BOOT_SPLASH_STATE>
  >(CONST.BOOT_SPLASH_STATE.VISIBLE);
  const [isAuthDataReady, setIsAuthDataReady] = useState(false);
  const splashScreenStateContext = useMemo(
    () => ({
      splashScreenState,
      setSplashScreenState,
      isAuthDataReady,
      setIsAuthDataReady,
    }),
    [splashScreenState, isAuthDataReady],
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
export {SplashScreenStateContextProvider, useSplashScreenStateContext};
