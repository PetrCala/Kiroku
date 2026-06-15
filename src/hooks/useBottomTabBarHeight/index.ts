/**
 * Web: the custom JS tab bar (see `BottomTabBar`) is a normal-flow sibling
 * below the scene in `@react-navigation/bottom-tabs`' `BottomTabView` column,
 * NOT an overlay. The scene already ends at the top of the bar, so content
 * needs no extra clearance. Returning the bar height here would double-inset
 * every consumer (FAB/search offset, scroll `paddingBottom`, offline-indicator
 * margin), stacking a bar-sized dead band above the bar; this is the same bug
 * fixed on Android (see `index.android.ts`).
 *
 * iOS keeps the measured height (`index.native.ts`) because there the bar
 * genuinely overlays the scene.
 */
function useBottomTabBarHeight(): number {
  return 0;
}

export default useBottomTabBarHeight;
