/**
 * The bottom tab bar (custom JS `BottomTabBar`) is a normal-flow sibling laid
 * out *below* the scene by `@react-navigation/bottom-tabs`' `BottomTabView`, on
 * every platform — NOT an overlay. The scene already ends at the top of the bar,
 * so tab-root content needs no extra bottom clearance. Returning the bar height
 * here would double-inset every consumer (FAB/search offset, scroll
 * `paddingBottom`, offline-indicator margin), stacking a bar-sized dead band
 * above the bar.
 *
 * (Before moving off the native `react-native-bottom-tabs` bar, iOS returned a
 * measured height here because that bar overlaid the scene. The JS bar does not
 * overlay, so all platforms now return 0.)
 */
function useBottomTabBarHeight(): number {
  return 0;
}

export default useBottomTabBarHeight;
