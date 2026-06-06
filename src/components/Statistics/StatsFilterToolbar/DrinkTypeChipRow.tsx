import React, {useCallback} from 'react';
import {StyleSheet} from 'react-native';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import {DRINK_KEY_LABEL, DRINK_KEY_ORDER} from '@libs/Statistics/drinkKeyMeta';
import type {DrinkKey} from '@src/types/onyx/Drinks';

const DRINK_LABELS = DRINK_KEY_ORDER.map(key => ({
  key,
  labelKey: DRINK_KEY_LABEL[key],
}));

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    columnGap: 6,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

type Props = {
  value: ReadonlySet<DrinkKey>;
  onChange: (next: ReadonlySet<DrinkKey>) => void;
};

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({label, selected, onPress}: ChipProps) {
  const {appColor, border, text, textReversed} = useTheme();
  return (
    <PressableWithFeedback
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? appColor : 'transparent',
          borderColor: selected ? appColor : border,
        },
      ]}>
      <Text color={selected ? textReversed : text} fontSize={13}>
        {label}
      </Text>
    </PressableWithFeedback>
  );
}

function DrinkTypeChipRow({value, onChange}: Props) {
  const {translate} = useLocalize();
  const isAllSelected = value.size === 0;

  const toggle = useCallback(
    (key: DrinkKey) => {
      const next = new Set(value);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      onChange(next);
    },
    [value, onChange],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // The row sits inside the statistics pager (react-native-pager-view),
      // which sets up no gesture coordination with nested scroll views. Letting
      // this row overscroll at its edge bleeds the residual drag into the
      // pager, nudging the whole tab. Pinning it to its content bounds keeps the
      // chip scroll fully isolated.
      bounces={false}
      overScrollMode="never"
      contentContainerStyle={styles.content}
      accessibilityLabel={translate(
        'statistics.filters.a11y.drinkTypeChipRow',
      )}>
      <Chip
        key="all"
        label={translate('statistics.filters.drinkType.all')}
        selected={isAllSelected}
        onPress={() => onChange(new Set())}
      />
      {DRINK_LABELS.map(({key, labelKey}) => (
        <Chip
          key={key}
          label={translate(labelKey)}
          selected={value.has(key)}
          onPress={() => toggle(key)}
        />
      ))}
    </ScrollView>
  );
}

DrinkTypeChipRow.displayName = 'DrinkTypeChipRow';

export default DrinkTypeChipRow;
