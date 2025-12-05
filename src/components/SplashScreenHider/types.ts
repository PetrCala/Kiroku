import type {ReactNode} from 'react';

type SplashScreenHiderProps = {
  /** Splash screen has been hidden */
  onHide: () => void;

  /** Whether the splash screen should remain visible (default: true) */
  isVisible?: boolean;
};

type SplashScreenHiderReturnType = ReactNode;

export type {SplashScreenHiderProps, SplashScreenHiderReturnType};
