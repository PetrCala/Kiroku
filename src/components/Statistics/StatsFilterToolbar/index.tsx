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
import SessionTypeToggle from './SessionTypeToggle';
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
  rightColumn: {
    // Right-align Compare + Live only so their right edges sit flush.
    alignItems: 'flex-end',
    // MUST match RangeSegmentedControl's rowGap so a wrapped period row lines up
    // with the Live-only button on the second row.
    rowGap: 6,
  },
});

type StatsFilterToolbarProps = {
  /**
   * Whether to show the drink-type chip row. The Overview tab opts out
   * because it reports total-alcohol only (drink-type slicing lives in the
   * Breakdown tab).
   */
  showDrinkTypeFilter?: boolean;

  /**
   * Whether to show the "Live only" toggle (sits under the Compare button).
   * Only the Patterns tab opts in, since `liveOnly` only filters that tab's
   * timing charts.
   */
  showSessionTypeToggle?: boolean;
};

function StatsFilterToolbar({
  showDrinkTypeFilter = true,
  showSessionTypeToggle = false,
}: StatsFilterToolbarProps) {
  const {appBG, border} = useTheme();
  const {translate} = useLocalize();
  const {
    range,
    setRange,
    goToPreviousPeriod,
    goToNextPeriod,
    goToLatest,
    revertFromCustom,
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
        <View style={styles.rightColumn}>
          <ComparisonToggle value={comparison} onChange={setComparison} />
          {showSessionTypeToggle ? <SessionTypeToggle /> : null}
        </View>
      </View>
      <StatsRangeNavigator
        range={range}
        onPrev={goToPreviousPeriod}
        onNext={goToNextPeriod}
        onJumpToLatest={goToLatest}
        onRevert={revertFromCustom}
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

export {default as StatsFilterToolbarSkeleton} from './StatsFilterToolbarSkeleton';

export default StatsFilterToolbar;
