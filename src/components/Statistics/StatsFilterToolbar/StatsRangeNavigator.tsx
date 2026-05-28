import React from 'react';
import {StyleSheet, View} from 'react-native';
import ArrowIcon from '@components/DatePicker/CalendarPicker/ArrowIcon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import getStatsRangeLabel from '@libs/StatsRangeLabel';
import type {Range} from '@components/StatsContextProvider/types';
import CONST from '@src/CONST';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    rowGap: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  label: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  labelText: {
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

type Props = {
  range: Range;
  onPrev: () => void;
  onNext: () => void;
  onJumpToLatest: () => void;
  onPressLabel: () => void;
};

function StatsRangeNavigator({
  range,
  onPrev,
  onNext,
  onJumpToLatest,
  onPressLabel,
}: Props) {
  const {translate, preferredLocale} = useLocalize();
  const {appColor, text, textReversed} = useTheme();

  const label = getStatsRangeLabel({range, translate, preferredLocale});
  const {isPageable, canGoPrev, canGoNext, isLatest} = range;

  return (
    <View style={styles.container}>
      <View style={styles.navRow}>
        {isPageable && (
          <PressableWithFeedback
            shouldUseAutoHitSlop={false}
            disabled={!canGoPrev}
            onPress={onPrev}
            hoverDimmingValue={1}
            accessibilityLabel={translate(
              'statistics.filters.a11y.previousPeriod',
            )}
            accessibilityState={{disabled: !canGoPrev}}>
            <ArrowIcon disabled={!canGoPrev} direction={CONST.DIRECTION.LEFT} />
          </PressableWithFeedback>
        )}
        <PressableWithFeedback
          onPress={onPressLabel}
          accessibilityLabel={translate('statistics.filters.a11y.rangeLabel')}
          accessibilityRole="button"
          style={styles.label}>
          <Text color={text} fontSize={15} style={styles.labelText}>
            {label}
          </Text>
        </PressableWithFeedback>
        {isPageable && (
          <PressableWithFeedback
            shouldUseAutoHitSlop={false}
            disabled={!canGoNext}
            onPress={onNext}
            hoverDimmingValue={1}
            accessibilityLabel={translate('statistics.filters.a11y.nextPeriod')}
            accessibilityState={{disabled: !canGoNext}}>
            <ArrowIcon disabled={!canGoNext} />
          </PressableWithFeedback>
        )}
      </View>
      {isPageable && !isLatest && (
        <PressableWithFeedback
          onPress={onJumpToLatest}
          accessibilityLabel={translate('statistics.filters.a11y.jumpToLatest')}
          accessibilityRole="button"
          style={[styles.pill, {backgroundColor: appColor}]}>
          <Text color={textReversed} fontSize={12}>
            {translate('statistics.filters.label.jumpToLatest')}
          </Text>
        </PressableWithFeedback>
      )}
    </View>
  );
}

StatsRangeNavigator.displayName = 'StatsRangeNavigator';

export default StatsRangeNavigator;
