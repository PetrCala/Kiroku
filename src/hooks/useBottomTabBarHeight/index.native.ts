import {useContext} from 'react';
import {BottomTabBarHeightContext} from 'react-native-bottom-tabs';
import variables from '@src/styles/variables';

/**
 * The height of the native bottom tab bar (bar + bottom safe-area inset),
 * read from `react-native-bottom-tabs`' context. Tab-root screens use this to
 * inset scroll content (and lift the Home FAB) so nothing is hidden behind the
 * bar, which overlays the scene rather than insetting it.
 *
 * Reads the context directly (rather than the library's `useBottomTabBarHeight`,
 * which throws without a provider) so it degrades gracefully to the static bar
 * height if ever rendered outside the tab navigator.
 *
 * The library seeds the context with `0` and only reports the real height once
 * the native bar measures itself a frame or two after mount. We treat that `0`
 * (and a missing provider, `undefined`) as "unmeasured" and fall back to the
 * static height — note a plain `??` would not, since `0` is non-nullish. This
 * keeps tab-bar insets correct from the first frame, so the Home FAB never
 * starts out behind the bar and then pops above it once the measurement lands.
 */
function useBottomTabBarHeight(): number {
  const measuredHeight = useContext(BottomTabBarHeightContext);
  if (!measuredHeight) {
    return variables.bottomTabHeight;
  }
  return measuredHeight;
}

export default useBottomTabBarHeight;
