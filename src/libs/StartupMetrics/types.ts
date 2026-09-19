/**
 * Marks the app records itself, to close the two gaps the native cold-start
 * marks leave: when the splash gate opened, and when the splash was actually
 * gone from the screen.
 */
type StartupMark = 'splashHideStart' | 'splashHidden';

type StartupMetrics = {
  init: () => void;
  mark: (name: StartupMark) => void;
};

export type {StartupMark};
export default StartupMetrics;
