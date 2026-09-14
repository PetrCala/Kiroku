import {useSyncExternalStore} from 'react';
import Clock from '@libs/Clock';

/**
 * The current time in milliseconds, updated once a second while the app is in
 * the foreground. Only the component calling this re-renders on each tick, so
 * keep it in a small leaf (see `ElapsedTime`), not in a screen.
 */
function useCurrentTime(): number {
  return useSyncExternalStore(Clock.subscribe, Clock.getNow);
}

export default useCurrentTime;
