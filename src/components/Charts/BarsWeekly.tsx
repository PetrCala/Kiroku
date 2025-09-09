import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import type {Point} from '@analytics/types';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';

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
  const {translate} = useLocalize();

  return (
    <View style={[styles.p4, styles.cardBG]}>
      {targetLine != null && (
        <Text style={[styles.textSupporting, styles.mb2]}>
          {translate('charts.target')}: {targetLine}
        </Text>
      )}
      {data.length === 0 ? (
        <Text style={styles.textSupporting}>{translate('charts.noData')}</Text>
      ) : (
        data.map(p => (
          <View
            key={p.x}
            style={[styles.flexRow, styles.justifyContentBetween, styles.mb1]}>
            <Text style={styles.textSupporting}>
              {formatX ? formatX(p.x) : p.x}:
            </Text>
            <Text style={styles.textStrong}>
              {formatY ? formatY(p.y) : p.y} {translate('charts.units')}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}
