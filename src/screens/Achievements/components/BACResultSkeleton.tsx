import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

const internalStyles = StyleSheet.create({
  headerLabel: {width: 120, height: 12, borderRadius: 3},
  value: {width: 96, height: 32, borderRadius: 6, marginTop: 8},
  pill: {width: 44, height: 28, borderRadius: 14},
  pillWide: {width: 72, height: 28, borderRadius: 14},
  soberLine: {width: 160, height: 12, borderRadius: 3},
  disclaimer: {width: '80%', height: 10, borderRadius: 3},
});

/**
 * Layout-faithful placeholder for `<BACResult>`, shown while its Skia decay
 * chart (`BaseChart` + `useChartFont`) is deferred past the navigation slide.
 * Mirrors the BAC value header, unit toggles, and chart area — without
 * importing Skia / victory-native, so the first frame stays cheap (same
 * discipline as `StatisticsScreenSkeleton`).
 */
function BACResultSkeleton() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const block = {backgroundColor: theme.highlightBG};

  return (
    <View
      style={[styles.flex1, styles.alignItemsCenter, styles.ph5, styles.pt4]}
      testID="BACResultSkeleton">
      <View style={[internalStyles.headerLabel, block]} />
      <View style={[internalStyles.value, block]} />

      <View style={[styles.flexRow, styles.mt4, {gap: 8}]}>
        {[0, 1, 2].map(i => (
          <View key={`unit-${i}`} style={[internalStyles.pill, block]} />
        ))}
      </View>

      <View style={[styles.alignSelfStretch, styles.mt6]}>
        <View
          style={[
            styles.flexRow,
            styles.justifyContentCenter,
            styles.mb2,
            {gap: 8},
          ]}>
          {[0, 1].map(i => (
            <View key={`tf-${i}`} style={[internalStyles.pillWide, block]} />
          ))}
        </View>
        <View
          style={[
            internalStyles.soberLine,
            block,
            styles.alignSelfCenter,
            styles.mb2,
          ]}
        />
        <ChartSkeleton variant="grid" height={200} />
      </View>

      <View style={[internalStyles.disclaimer, block, styles.mt6]} />
    </View>
  );
}

BACResultSkeleton.displayName = 'BACResultSkeleton';
export default BACResultSkeleton;
