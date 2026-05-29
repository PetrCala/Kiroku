import React, {useCallback, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import useStatsContext from '@hooks/useStatsContext';
import useTheme from '@hooks/useTheme';
import DateSelectorModal from '@components/DateSelectorModal';
import type {RangePreset} from '@components/StatsContextProvider/types';
import ComparisonToggle from './ComparisonToggle';
import DrinkTypeChipRow from './DrinkTypeChipRow';
import RangeSegmentedControl from './RangeSegmentedControl';
import StatsRangeNavigator from './StatsRangeNavigator';

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

type StatsFilterToolbarProps = {
  /**
   * Whether to show the drink-type chip row. The Overview tab opts out
   * because it reports total-alcohol only (drink-type slicing lives in the
   * Breakdown tab).
   */
  showDrinkTypeFilter?: boolean;
};

function StatsFilterToolbar({
  showDrinkTypeFilter = true,
}: StatsFilterToolbarProps) {
  const {appBG, border} = useTheme();
  const {translate} = useLocalize();
  const {
    range,
    setRange,
    goToPreviousPeriod,
    goToNextPeriod,
    goToLatest,
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
      <StatsRangeNavigator
        range={range}
        onPrev={goToPreviousPeriod}
        onNext={goToNextPeriod}
        onJumpToLatest={goToLatest}
        onPressLabel={() => setPickerOpen(true)}
      />
      {showDrinkTypeFilter ? (
        <DrinkTypeChipRow
          value={drinkTypeFilter}
          onChange={setDrinkTypeFilter}
        />
      ) : null}
      <DateSelectorModal
        mode="range"
        isVisible={pickerOpen}
        title={translate('statistics.filters.customRange.title')}
        applyText={translate('statistics.filters.customRange.apply')}
        cancelText={translate('statistics.filters.customRange.cancel')}
        maxDate={new Date()}
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
