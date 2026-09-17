import React from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import useThemeStyles from '@hooks/useThemeStyles';

type Choice<T> = {
  /** The value this chip stands for */
  value: T;

  /** What the chip reads */
  label: string;
};

type ChoiceChipsProps<T> = {
  /** The chips to offer, in order */
  choices: Array<Choice<T>>;

  /** The currently picked value */
  selected: T;

  /** Called with the value of the chip that was pressed */
  onSelect: (value: T) => void;

  /** Test id prefix; each chip gets `<prefix>-<index>` */
  testIDPrefix: string;
};

/**
 * A wrapping row of single-choice chips, for the short lists the capture UI
 * offers: which serving a drink was, and how long ago it happened. Short
 * enough that a picker or a dropdown would cost more taps than it saves.
 *
 * The picked chip is the success-coloured one, which is the same "this is
 * chosen" signal the session screen's primary action uses.
 */
function ChoiceChips<T extends string | number>({
  choices,
  selected,
  onSelect,
  testIDPrefix,
}: ChoiceChipsProps<T>) {
  const styles = useThemeStyles();

  return (
    <View style={[styles.flexRow, styles.flexWrap, styles.gap1]}>
      {choices.map((choice, index) => {
        const isSelected = choice.value === selected;
        return (
          <Button
            key={String(choice.value)}
            small
            success={isSelected}
            text={choice.label}
            onPress={() => onSelect(choice.value)}
            testID={`${testIDPrefix}-${index}`}
            accessibilityLabel={choice.label}
          />
        );
      })}
    </View>
  );
}

export default ChoiceChips;
export type {Choice, ChoiceChipsProps};
