import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';

type Props = {
  label: string;
  value: number | string;
  unit?: string;
  deltaPct?: number; // optional, +/-
};

function getDeltaPct(deltaPct: number): string {
  if (deltaPct > 0) {
    return '▲';
  }
  if (deltaPct < 0) {
    return '▼';
  }
  return '–';
}

function KpiTile({label, value, unit, deltaPct}: Props) {
  const styles = useThemeStyles();

  return (
    <View
      style={[
        styles.p4,
        styles.borderRadiusNormal,
        styles.cardBG,
        styles.shadowStrong,
      ]}>
      <Text style={[styles.textSupporting, styles.mb1]}>{label}</Text>
      <Text style={[styles.textHeadlineH1, styles.textStrong]}>
        {value}
        {unit ? ` ${unit}` : ''}
      </Text>
      {typeof deltaPct === 'number' && (
        <Text style={[styles.textSupporting, styles.mt1]}>
          {getDeltaPct(deltaPct)} {Math.abs(deltaPct).toFixed(1)}%
        </Text>
      )}
    </View>
  );
}

export default KpiTile;
