import React, {useCallback} from 'react';
import {StyleSheet} from 'react-native';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import type {Comparison} from '@components/StatsContextProvider/types';
import type {TranslationPaths} from '@src/languages/types';

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});

function getNextComparison(current: Comparison): Comparison {
  if (current === 'none') {
    return 'previous-period';
  }
  if (current === 'previous-period') {
    return 'previous-year';
  }
  return 'none';
}

function getLabelKey(value: Comparison): TranslationPaths {
  if (value === 'none') {
    return 'statistics.filters.comparison.none';
  }
  if (value === 'previous-period') {
    return 'statistics.filters.comparison.previousPeriod';
  }
  return 'statistics.filters.comparison.previousYear';
}

type Props = {
  value: Comparison;
  onChange: (next: Comparison) => void;
};

function ComparisonToggle({value, onChange}: Props) {
  const {translate} = useLocalize();
  const {appColor, border, text, textReversed} = useTheme();

  const cycle = useCallback(() => {
    onChange(getNextComparison(value));
  }, [value, onChange]);

  const isActive = value !== 'none';

  return (
    <PressableWithFeedback
      accessibilityLabel={translate('statistics.filters.a11y.comparisonToggle')}
      accessibilityRole="button"
      accessibilityState={{selected: isActive}}
      onPress={cycle}
      style={[
        styles.pill,
        {
          backgroundColor: isActive ? appColor : 'transparent',
          borderColor: isActive ? appColor : border,
        },
      ]}>
      <Text color={isActive ? textReversed : text} fontSize={13}>
        {translate(getLabelKey(value))}
      </Text>
    </PressableWithFeedback>
  );
}

ComparisonToggle.displayName = 'ComparisonToggle';

export default ComparisonToggle;
