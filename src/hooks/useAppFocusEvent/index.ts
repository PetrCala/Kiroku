import {useEffect} from 'react';
import type {UseAppFocusEvent, UseAppFocusEventCallback} from './types';

/**
 * Runs `callback` when the window regains focus (re-opening the tab or switching
 * back to the window) — the web counterpart of the native AppState listener.
 */
const useAppFocusEvent: UseAppFocusEvent = (
  callback: UseAppFocusEventCallback,
) => {
  useEffect(() => {
    window.addEventListener('focus', callback);

    return () => {
      window.removeEventListener('focus', callback);
    };
  }, [callback]);
};

export default useAppFocusEvent;
