import {useCallback, useEffect, useRef, useState} from 'react';
import CONST from '@src/CONST';

// transitionEnd (below) can fire under 600ms after mount, before the slide
// has visually settled on screen. Holding isReady back by this much past the
// event keeps the heavy mount off the tail of the slide instead of landing
// mid-animation.
const TRANSITION_END_SETTLE_BUFFER = 200;

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
 * `transitionEnd` itself fires too early to gate on directly: measured on the
 * friend-profile push, it can land under 600ms after mount, while the slide
 * is still visually settling. Gating only on that event let the calendar and
 * stats card skip their skeleton entirely and mount mid-slide, which read as
 * a stray element popping in near the end of the transition. The
 * `TRANSITION_END_SETTLE_BUFFER` delay holds the mount back until the slide
 * is actually done painting, not just until JS was told it ended.
 *
 * The safety-net timeout is unconditional: if `transitionEnd` never fires for
 * a given platform/modal presentation, `isReady` still flips so the screen
 * can't get stuck on its skeleton.
 */
function useReadyAfterScreenTransition(): ReadyAfterScreenTransition {
  const [isReady, setIsReady] = useState(false);
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEntryTransitionEnd = useCallback(() => {
    bufferTimeoutRef.current = setTimeout(
      () => setIsReady(true),
      TRANSITION_END_SETTLE_BUFFER,
    );
  }, []);

  useEffect(() => {
    const safetyTimeoutId = setTimeout(
      () => setIsReady(true),
      CONST.SCREEN_TRANSITION_END_TIMEOUT,
    );
    return () => {
      clearTimeout(safetyTimeoutId);
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }
    };
  }, []);

  return {isReady, onEntryTransitionEnd};
}

export default useReadyAfterScreenTransition;
