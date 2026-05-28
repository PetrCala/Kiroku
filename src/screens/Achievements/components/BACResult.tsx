import React from 'react';
import {View} from 'react-native';
import StatItem from '@components/Items/StatItem';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';

type BACResultProps = {
  /** Estimated BAC as a percentage (g/100ml). */
  bacPercent: number;
};

function BACResult({bacPercent}: BACResultProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const perMille = (bacPercent * 10).toFixed(2);
  const percent = bacPercent.toFixed(2);

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
        content={`${perMille}‰ (${percent}%)`}
      />
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
