import React from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import StatItem from '@components/Items/StatItem';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import type {BacDisplayUnit} from '@src/types/onyx';

type BACResultProps = {
  /** Estimated BAC as a percentage (g/100ml). */
  bacPercent: number;

  /** Which unit to display the estimate in. */
  displayUnit: BacDisplayUnit;

  /** Called when the user picks a different display unit. */
  onChangeDisplayUnit: (unit: BacDisplayUnit) => void;
};

function BACResult({
  bacPercent,
  displayUnit,
  onChangeDisplayUnit,
}: BACResultProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const perMille = `${(bacPercent * 10).toFixed(2)}‰`;
  const percent = `${bacPercent.toFixed(2)}%`;

  let content: string;
  if (displayUnit === CONST.BAC.DISPLAY_UNIT.PERCENT) {
    content = percent;
  } else if (displayUnit === CONST.BAC.DISPLAY_UNIT.BOTH) {
    content = `${perMille} (${percent})`;
  } else {
    content = perMille;
  }

  const unitOptions: Array<{value: BacDisplayUnit; label: string}> = [
    {value: CONST.BAC.DISPLAY_UNIT.PER_MILLE, label: '‰'},
    {value: CONST.BAC.DISPLAY_UNIT.PERCENT, label: '%'},
    {
      value: CONST.BAC.DISPLAY_UNIT.BOTH,
      label: translate('achievementsScreen.bac.displayBoth'),
    },
  ];

  return (
    <View
      style={[
        styles.flex1,
        styles.alignItemsCenter,
        styles.justifyContentCenter,
        styles.ph5,
      ]}>
      <StatItem
        header={translate('achievementsScreen.bac.currentBac')}
        content={content}
      />

      <View style={[styles.flexRow, styles.mt4, {gap: 8}]}>
        {unitOptions.map(option => (
          <Button
            key={option.value}
            small
            text={option.label}
            success={displayUnit === option.value}
            onPress={() => onChangeDisplayUnit(option.value)}
          />
        ))}
      </View>

      <Text
        style={[
          styles.textLabelSupporting,
          styles.textAlignCenter,
          styles.mt6,
        ]}>
        {translate('achievementsScreen.bac.disclaimer')}
      </Text>
    </View>
  );
}

BACResult.displayName = 'BACResult';
export default BACResult;
