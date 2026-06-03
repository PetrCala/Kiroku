import React from 'react';
import {View} from 'react-native';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import useThemeStyles from '@hooks/useThemeStyles';

/**
 * Layout-faithful placeholder for `<BACResult>`, shown while its Skia decay
 * chart (`BaseChart` + `useChartFont`) is deferred past the navigation slide.
 * Mirrors the BAC value header, unit toggles, and chart area — without
 * importing Skia / victory-native, so the first frame stays cheap (same
 * discipline as `StatisticsScreenSkeleton`). The `grid` variant defaults to the
 * same 200dp height the real decay chart uses, so the swap stays quiet.
 */
function BACResultSkeleton() {
  const styles = useThemeStyles();

  return (
    <View
      style={[styles.flex1, styles.alignItemsCenter, styles.ph5, styles.pt4]}
      testID="BACResultSkeleton">
      <View style={styles.bacResultSkeletonHeaderLabel} />
      <View style={styles.bacResultSkeletonValue} />

      <View style={[styles.bacResultSkeletonPillRow, styles.mt4]}>
        {[0, 1, 2].map(i => (
          <View key={`unit-${i}`} style={styles.bacResultSkeletonPill} />
        ))}
      </View>

      <View style={[styles.alignSelfStretch, styles.mt6]}>
        <View
          style={[
            styles.bacResultSkeletonPillRow,
            styles.justifyContentCenter,
            styles.mb2,
          ]}>
          {[0, 1].map(i => (
            <View key={`tf-${i}`} style={styles.bacResultSkeletonPillWide} />
          ))}
        </View>
        <View
          style={[
            styles.bacResultSkeletonSoberLine,
            styles.alignSelfCenter,
            styles.mb2,
          ]}
        />
        <ChartSkeleton variant="grid" />
      </View>

      <View style={[styles.bacResultSkeletonDisclaimer, styles.mt6]} />
    </View>
  );
}

BACResultSkeleton.displayName = 'BACResultSkeleton';
export default BACResultSkeleton;
