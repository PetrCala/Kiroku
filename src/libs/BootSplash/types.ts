type VisibilityStatus = 'visible' | 'hidden';

type BootSplashModule = {
  hide: () => Promise<void>;
  getVisibilityStatus: () => Promise<VisibilityStatus>;
};

export type {BootSplashModule, VisibilityStatus};
