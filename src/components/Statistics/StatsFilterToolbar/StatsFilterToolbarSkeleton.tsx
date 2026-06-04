import {StyleSheet, View} from 'react-native';
import Skeleton from '@components/Skeleton';
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
  },
  chipRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
});

const CHIP_COUNT = 4;

/**
 * Static, layout-faithful placeholder for `StatsFilterToolbar`. Used by the
 * Statistics loading skeletons (full-screen skeleton + per-tab lazy
 * placeholder). Imports nothing heavy — only `View` + the shared `Skeleton`
 * primitive — so it stays out of the deferred chart bundle.
 */
function StatsFilterToolbarSkeleton({
  showDrinkTypeFilter = true,
}: StatsFilterToolbarSkeletonProps) {
  const theme = useTheme();

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
        <View style={styles.segmented}>
          <Skeleton width="100%" height={32} radius={8} />
        </View>
        <Skeleton width={88} height={32} radius={8} />
      </View>
      <View style={styles.row}>
        <Skeleton width={28} height={28} radius={6} />
        <Skeleton width={140} height={18} radius={6} />
        <Skeleton width={28} height={28} radius={6} />
      </View>
      {showDrinkTypeFilter ? (
        <View style={styles.chipRow}>
          {Array.from({length: CHIP_COUNT}, (_v, i) => (
            <Skeleton
              // eslint-disable-next-line react/no-array-index-key
              key={`chip-${i}`}
              width={56}
              height={28}
              radius={14}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

StatsFilterToolbarSkeleton.displayName = 'StatsFilterToolbarSkeleton';

export default StatsFilterToolbarSkeleton;
