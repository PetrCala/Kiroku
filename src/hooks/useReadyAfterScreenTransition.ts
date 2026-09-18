import {useCallback, useEffect, useState} from 'react';
import CONST from '@src/CONST';

type ReadyAfterScreenTransition = {
  /** Whether the screen's entry transition has finished (or the safety-net
   *  timeout has elapsed), so deferred heavy content may now mount. */
  isReady: boolean;

  /** Wire to `ScreenWrapper`'s `onEntryTransitionEnd` prop. */
  onEntryTransitionEnd: () => void;
};

/**
 * Gates heavy work behind a screen's entry transition so the navigation slide
 * can paint before the JS thread is blocked by a costly mount.
 *
 * Wire {@link ReadyAfterScreenTransition.onEntryTransitionEnd} to
 * `ScreenWrapper`'s prop of the same name — it fires on react-navigation's
 * `transitionEnd` event, i.e. *after* the slide.
 * `InteractionManager.runAfterInteractions` is unsuitable for this: its
 * interaction handle is created before the navigation card's, so it resolves
 * before the slide finishes and the heavy mount still lands mid-transition,
 * freezing the source screen.
 *
 * The timeout is a safety net only: if `transitionEnd` never fires for a given
 * platform/modal presentation, `isReady` still flips so the screen can't get
 * stuck on its skeleton.
 */
function useReadyAfterScreenTransition(): ReadyAfterScreenTransition {
  const [isReady, setIsReady] = useState(false);
  const onEntryTransitionEnd = useCallback(() => setIsReady(true), []);

  useEffect(() => {
    const timeoutId = setTimeout(
      () => setIsReady(true),
      CONST.SCREEN_TRANSITION_END_TIMEOUT,
    );
    return () => clearTimeout(timeoutId);
  }, []);

  return {isReady, onEntryTransitionEnd};
}

export default useReadyAfterScreenTransition;
