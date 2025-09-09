import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import type {Point} from '@analytics/types';
import useThemeStyles from '@hooks/useThemeStyles';

type Props = {
  data: Point[];
  formatX?: (x: string) => string;
  formatY?: (y: number) => string;
};

function LineTrend({data, formatX, formatY}: Props) {
  const styles = useThemeStyles();

  return (
    <View style={[styles.p4, styles.cardBG]}>
      <Text style={[styles.textHeadline, styles.mb2]}>Trend</Text>
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

export default LineTrend;
