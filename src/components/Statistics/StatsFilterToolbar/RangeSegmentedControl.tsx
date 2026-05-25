import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import type {RangePreset} from '@components/StatsContextProvider/types';
import type {TranslationPaths} from '@src/languages/types';

const PRESETS: ReadonlyArray<{
  value: RangePreset;
  labelKey: TranslationPaths;
}> = [
  {value: 'W', labelKey: 'statistics.filters.range.W'},
  {value: 'M', labelKey: 'statistics.filters.range.M'},
  {value: '6M', labelKey: 'statistics.filters.range.sixM'},
  {value: 'Y', labelKey: 'statistics.filters.range.Y'},
  {value: 'All', labelKey: 'statistics.filters.range.all'},
  {value: 'Custom', labelKey: 'statistics.filters.range.custom'},
];

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
});

type Props = {
  value: RangePreset;
  onChange: (next: RangePreset) => void;
};

function RangeSegmentedControl({value, onChange}: Props) {
  const {translate} = useLocalize();
  const {appColor, border, text, textReversed} = useTheme();

  const renderPill = useCallback(
    (preset: RangePreset, labelKey: TranslationPaths) => {
      const isSelected = preset === value;
      return (
        <PressableWithFeedback
          key={preset}
          accessibilityLabel={translate(labelKey)}
          accessibilityRole="button"
          accessibilityState={{selected: isSelected}}
          onPress={() => onChange(preset)}
          style={[
            styles.pill,
            {
              backgroundColor: isSelected ? appColor : 'transparent',
              borderColor: isSelected ? appColor : border,
            },
          ]}>
          <Text color={isSelected ? textReversed : text} fontSize={13}>
            {translate(labelKey)}
          </Text>
        </PressableWithFeedback>
      );
    },
    [value, onChange, appColor, border, text, textReversed, translate],
  );

  return (
    <View
      accessibilityLabel={translate(
        'statistics.filters.a11y.rangeSegmentedControl',
      )}
      accessibilityRole="tablist"
      style={styles.row}>
      {PRESETS.map(({value: preset, labelKey}) => renderPill(preset, labelKey))}
    </View>
  );
}

RangeSegmentedControl.displayName = 'RangeSegmentedControl';

export default RangeSegmentedControl;
