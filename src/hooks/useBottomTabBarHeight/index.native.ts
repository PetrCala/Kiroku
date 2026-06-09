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
 */
function useBottomTabBarHeight(): number {
  return useContext(BottomTabBarHeightContext) ?? variables.bottomTabHeight;
}

export default useBottomTabBarHeight;
