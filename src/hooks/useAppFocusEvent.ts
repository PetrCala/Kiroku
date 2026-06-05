import {useEffect, useRef} from 'react';
import type {AppStateStatus} from 'react-native';
import {AppState} from 'react-native';
import CONST from '@src/CONST';

/**
 * Runs `callback` each time the app returns to the foreground (a transition
 * from background/inactive to active). The latest callback is invoked without
 * re-subscribing to AppState on every render.
 */
function useAppFocusEvent(callback: () => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let previousState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      const cameToForeground =
        (previousState === CONST.APP_STATE.INACTIVE ||
          previousState === CONST.APP_STATE.BACKGROUND) &&
        nextState === CONST.APP_STATE.ACTIVE;
      previousState = nextState;
      if (cameToForeground) {
        callbackRef.current();
      }
    });
    return () => subscription.remove();
  }, []);
}

export default useAppFocusEvent;
