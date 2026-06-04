import {useEffect} from 'react';
import {InteractionManager} from 'react-native';

/**
 * Warm heavy module graphs off the critical path. Once the app is idle — after
 * the current interactions / entry animations settle — each prefetcher runs
 * exactly once. Fire-and-forget; if the host unmounts before the idle callback
 * fires, the scheduled work is cancelled.
 *
 * Pass a stable (module-level) `prefetchers` array; a fresh array identity
 * re-schedules the warm, so don't build it inline in render.
 */
function useIdlePrefetch(prefetchers: ReadonlyArray<() => unknown>): void {
  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }
      for (const prefetch of prefetchers) {
        prefetch();
      }
    });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [prefetchers]);
}

export default useIdlePrefetch;
