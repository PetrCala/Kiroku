import {StyleSheet, View} from 'react-native';
import useTheme from '@hooks/useTheme';

type StatsFilterToolbarSkeletonProps = {
  /**
   * Mirror of `StatsFilterToolbar`'s prop — when false the drink-type chip
   * row is omitted (the Overview tab opts out).
   */
  showDrinkTypeFilter?: boolean;
};

// Mirrors the real toolbar container in StatsFilterToolbar/index.tsx so the
// strip occupies the same vertical space and the swap to the real toolbar
// doesn't shift the content below it.
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    rowGap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  segmented: {
    flex: 1,
    height: 32,
    borderRadius: 8,
  },
  comparison: {
    width: 88,
    height: 32,
    borderRadius: 8,
  },
  navArrow: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  navLabel: {
    height: 18,
    width: 140,
    borderRadius: 6,
  },
  chipRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  chip: {
    width: 56,
    height: 28,
    borderRadius: 14,
  },
});

const CHIP_COUNT = 4;

/**
 * Static, layout-faithful placeholder for `StatsFilterToolbar`. Used by the
 * Statistics loading skeletons (full-screen skeleton + per-tab lazy
 * placeholder). Imports nothing heavy — only `View` + the theme — so it stays
 * out of the deferred chart bundle.
 */
function StatsFilterToolbarSkeleton({
  showDrinkTypeFilter = true,
}: StatsFilterToolbarSkeletonProps) {
  const theme = useTheme();
  const fill = theme.highlightBG;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        styles.container,
        {backgroundColor: theme.appBG, borderBottomColor: theme.border},
      ]}>
      <View style={styles.row}>
        <View style={[styles.segmented, {backgroundColor: fill}]} />
        <View style={[styles.comparison, {backgroundColor: fill}]} />
      </View>
      <View style={styles.row}>
        <View style={[styles.navArrow, {backgroundColor: fill}]} />
        <View style={[styles.navLabel, {backgroundColor: fill}]} />
        <View style={[styles.navArrow, {backgroundColor: fill}]} />
      </View>
      {showDrinkTypeFilter ? (
        <View style={styles.chipRow}>
          {Array.from({length: CHIP_COUNT}, (_v, i) => (
            <View
              // eslint-disable-next-line react/no-array-index-key
              key={`chip-${i}`}
              style={[styles.chip, {backgroundColor: fill}]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

StatsFilterToolbarSkeleton.displayName = 'StatsFilterToolbarSkeleton';

export default StatsFilterToolbarSkeleton;
