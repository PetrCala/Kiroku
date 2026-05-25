import React, {useCallback, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import useStatsContext from '@hooks/useStatsContext';
import useTheme from '@hooks/useTheme';
import StatsRangePickerModal from '@components/Statistics/StatsRangePickerModal';
import type {RangePreset} from '@components/StatsContextProvider/types';
import ComparisonToggle from './ComparisonToggle';
import DrinkTypeChipRow from './DrinkTypeChipRow';
import RangeSegmentedControl from './RangeSegmentedControl';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    rowGap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  rangeWrapper: {
    flex: 1,
  },
});

function StatsFilterToolbar() {
  const {appBG, border} = useTheme();
  const {
    range,
    setRange,
    comparison,
    setComparison,
    drinkTypeFilter,
    setDrinkTypeFilter,
  } = useStatsContext();

  const [pickerOpen, setPickerOpen] = useState(false);

  const handleRangeChange = useCallback(
    (next: RangePreset) => {
      if (next === 'Custom') {
        setPickerOpen(true);
        return;
      }
      setRange({preset: next});
    },
    [setRange],
  );

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: appBG, borderBottomColor: border},
      ]}>
      <View style={styles.row}>
        <View style={styles.rangeWrapper}>
          <RangeSegmentedControl
            value={range.preset}
            onChange={handleRangeChange}
          />
        </View>
        <ComparisonToggle value={comparison} onChange={setComparison} />
      </View>
      <DrinkTypeChipRow value={drinkTypeFilter} onChange={setDrinkTypeFilter} />
      <StatsRangePickerModal
        isVisible={pickerOpen}
        initialStart={range.start}
        initialEnd={range.end}
        onCancel={() => setPickerOpen(false)}
        onApply={(start, end) => {
          setRange({preset: 'Custom', start, end});
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

StatsFilterToolbar.displayName = 'StatsFilterToolbar';

export default StatsFilterToolbar;
