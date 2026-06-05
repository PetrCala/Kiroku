import {useEffect} from 'react';
import {AppState} from 'react-native';
import type {UseAppFocusEvent, UseAppFocusEventCallback} from './types';

/**
 * Runs `callback` each time the app returns to the foreground (AppState becomes
 * active), e.g. after the user switches back from another app.
 */
const useAppFocusEvent: UseAppFocusEvent = (
  callback: UseAppFocusEventCallback,
) => {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', appState => {
      if (appState !== 'active') {
        return;
      }
      callback();
    });

    return () => {
      subscription.remove();
    };
  }, [callback]);
};

export default useAppFocusEvent;
