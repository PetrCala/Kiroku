import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import type {Point} from '@analytics/types';
import useThemeStyles from '@hooks/useThemeStyles';

type Props = {
  data: Point[]; // x = 'yyyy-LL-dd'
  formatX?: (x: string) => string;
  formatY?: (y: number) => string;
  targetLine?: number; // optional guideline per day
};

export default function BarsWeekly({
  data,
  formatX,
  formatY,
  targetLine,
}: Props) {
  const styles = useThemeStyles();

  return (
    <View style={[styles.p4, styles.cardBG]}>
      {targetLine != null && (
        <Text style={[styles.textSupporting, styles.mb2]}>
          Target: {targetLine}
        </Text>
      )}
      {data.map(p => (
        <View
          key={p.x}
          style={[styles.flexRow, styles.justifyContentBetween, styles.mb1]}>
          <Text style={styles.textSupporting}>
            {formatX ? formatX(p.x) : p.x}:
          </Text>
          <Text style={styles.textStrong}>{formatY ? formatY(p.y) : p.y}</Text>
        </View>
      ))}
    </View>
  );
}
