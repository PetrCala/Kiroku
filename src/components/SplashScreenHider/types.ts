import type {ReactNode} from 'react';

type SplashScreenHiderProps = {
  /** Callback fired after the hide animation completes */
  onHide: () => void;

  /** When true, triggers the hide animation */
  shouldHideSplash: boolean;
};

type SplashScreenHiderReturnType = ReactNode;

export type {SplashScreenHiderProps, SplashScreenHiderReturnType};
