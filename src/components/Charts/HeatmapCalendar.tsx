import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import type {HeatDay} from '@analytics/types';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';

type Props = {
  days: HeatDay[]; // last N days, contiguous
  scale?: 'count' | 'binary';
};

function getHeatmapValue(value: number, scale: 'count' | 'binary'): number {
  if (scale === 'binary') {
    return value > 0 ? 1 : 0;
  }
  return value;
}

function HeatmapCalendar({days, scale = 'count'}: Props) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  return (
    <View style={[styles.p4, styles.cardBG]}>
      <Text style={[styles.textHeadline, styles.mb2]}>
        {translate('charts.heatmap')} ({scale})
      </Text>
      {days.length === 0 ? (
        <Text style={styles.textSupporting}>{translate('charts.noData')}</Text>
      ) : (
        days.map(d => (
          <View
            key={d.date}
            style={[styles.flexRow, styles.justifyContentBetween, styles.mb1]}>
            <Text style={styles.textSupporting}>{d.date}:</Text>
            <Text style={styles.textStrong}>
              {getHeatmapValue(d.value, scale)} {translate('charts.units')}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export default HeatmapCalendar;
