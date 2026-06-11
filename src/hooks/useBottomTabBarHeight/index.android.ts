/**
 * Android: the native Material tab bar is NOT an overlay. In
 * `react-native-bottom-tabs`' `ReactBottomNavigationView` the scene area and
 * the bar are stacked siblings in a vertical LinearLayout (scene with
 * `weight=1`, bar below it), so the scene already ends at the top of the bar
 * and content needs NO extra clearance to stay visible.
 *
 * Returning the measured bar height here (as iOS does) double-insets every
 * consumer — scroll padding, the offline indicator's margin, the Home FAB
 * offset — stacking a bar-sized (or worse) dead band above the bar. Worse,
 * the library's Android measurement can report an inflated height at launch
 * and never re-report (its layout listener gates re-reports on the OUTER
 * view's size while reporting the INNER bar/scene sizes, so a bad first
 * capture sticks; see callstack/react-native-bottom-tabs#228), which blew the
 * dead band up to ~half the screen on Home/Social/Statistics.
 *
 * iOS keeps the measured height (`index.native.ts`): there the bar genuinely
 * overlays the scene. Web has its own static fallback (`index.ts`).
 */
function useBottomTabBarHeight(): number {
  return 0;
}

export default useBottomTabBarHeight;
