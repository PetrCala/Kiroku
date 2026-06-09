import variables from '@src/styles/variables';

/**
 * Web fallback: the custom JS tab bar (see `BottomTabBar`) is exactly
 * `variables.bottomTabHeight` tall, so scroll content insets by that amount.
 * Native overrides this in `index.native.ts` with the real measured bar height.
 */
function useBottomTabBarHeight(): number {
  return variables.bottomTabHeight;
}

export default useBottomTabBarHeight;
