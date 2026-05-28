import React, {useMemo} from 'react';
import {View} from 'react-native';
import {BaseChart, Line, useChartFont} from '@components/Charts/BaseChart';
import Button from '@components/Button';
import StatItem from '@components/Items/StatItem';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {formatBac} from '@libs/BACUtils';
import type {BacEstimate} from '@libs/BACUtils';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import type {ChartDatum} from '@libs/Statistics';
import CONST from '@src/CONST';
import type {BacDisplayUnit} from '@src/types/onyx';

type BACResultProps = {
  /** The aggregate BAC estimate (point + confidence band). */
  estimate: BacEstimate;

  /** Hour-by-hour BAC decline to zero; empty when already sober. */
  decayData: ChartDatum[];

  /** Hours until BAC reaches zero, for the time-to-sober label. */
  hoursToSober: number;

  /** Which unit to display the estimate in. */
  displayUnit: BacDisplayUnit;

  /** Called when the user picks a different display unit. */
  onChangeDisplayUnit: (unit: BacDisplayUnit) => void;

  /** Opens the per-session breakdown modal. */
  onShowDetails: () => void;
};

function formatSoberDuration(hoursToSober: number): string {
  const wholeHours = Math.floor(hoursToSober);
  const minutes = Math.round((hoursToSober - wholeHours) * 60);
  if (wholeHours <= 0) {
    return `${minutes}m`;
  }
  return `${wholeHours}h ${minutes}m`;
}

function BACResult({
  estimate,
  decayData,
  hoursToSober,
  displayUnit,
  onChangeDisplayUnit,
  onShowDetails,
}: BACResultProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const axisFont = useChartFont(11);

  const content = formatBac(estimate.point, displayUnit);

  const unitOptions: Array<{value: BacDisplayUnit; label: string}> = [
    {value: CONST.BAC.DISPLAY_UNIT.PER_MILLE, label: '‰'},
    {value: CONST.BAC.DISPLAY_UNIT.PERCENT, label: '%'},
    {
      value: CONST.BAC.DISPLAY_UNIT.BOTH,
      label: translate('achievementsScreen.bac.displayBoth'),
    },
  ];

  // The decay series carries raw BAC percent; scale it to the chosen unit so
  // the y-axis ticks match the headline number (‰ = percent × 10).
  const isPercentUnit = displayUnit === CONST.BAC.DISPLAY_UNIT.PERCENT;
  const yUnitLabel = isPercentUnit ? '%' : '‰';
  const chartData = useMemo<ChartDatum[]>(
    () =>
      decayData.map(point => ({
        x: point.x,
        y: roundToTwoDecimalPlaces(point.y * (isPercentUnit ? 1 : 10)),
      })),
    [decayData, isPercentUnit],
  );

  const showGraph = chartData.length > 1;

  // Explicit ticks for a scientific-graph look: whole-hour steps on X
  // (~6 labels max) and five evenly spaced BAC values on Y.
  const {xTicks, yTicks} = useMemo(() => {
    if (chartData.length === 0) {
      return {xTicks: [] as number[], yTicks: [] as number[]};
    }
    const lastHour = chartData[chartData.length - 1].x as number;
    const step = Math.max(1, Math.ceil(lastHour / 6));
    const xs: number[] = [];
    for (let hour = 0; hour <= lastHour; hour += step) {
      xs.push(hour);
    }
    const maxY = chartData[0].y;
    const ys = Array.from({length: 5}, (_, index) =>
      roundToTwoDecimalPlaces((maxY * index) / 4),
    ).filter((value, index, arr) => arr.indexOf(value) === index);
    return {xTicks: xs, yTicks: ys};
  }, [chartData]);

  return (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[
        styles.alignItemsCenter,
        styles.ph5,
        styles.pt4,
        styles.pb5,
      ]}>
      <StatItem
        header={translate('achievementsScreen.bac.currentBac')}
        content={content}
      />

      {estimate.hasBand ? (
        <Text
          style={[
            styles.textLabelSupporting,
            styles.textAlignCenter,
            styles.mt2,
          ]}>
          {translate('achievementsScreen.bac.range', {
            low: formatBac(estimate.low, displayUnit),
            high: formatBac(estimate.high, displayUnit),
          })}
        </Text>
      ) : null}

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

      {showGraph ? (
        <View style={[styles.alignSelfStretch, styles.mt6]}>
          <Text
            style={[
              styles.textLabelSupporting,
              styles.textAlignCenter,
              styles.mb2,
            ]}>
            {translate('achievementsScreen.bac.soberIn', {
              time: formatSoberDuration(hoursToSober),
            })}
          </Text>
          <BaseChart
            data={chartData}
            range="allTime"
            height={200}
            accessibilityLabel={translate(
              'achievementsScreen.bac.decayChartLabel',
            )}
            axis={{
              font: axisFont,
              tickValues: {x: xTicks, y: yTicks},
              formatXLabel: hour => `${hour}h`,
              formatYLabel: value =>
                `${roundToTwoDecimalPlaces(value)}${yUnitLabel}`,
            }}>
            {({points, theme}) => (
              <Line
                points={points.y}
                color={theme.primaryStroke}
                strokeWidth={2}
              />
            )}
          </BaseChart>
        </View>
      ) : null}

      <Button
        small
        style={[styles.mt6]}
        text={translate('achievementsScreen.bac.showDetails')}
        onPress={onShowDetails}
      />

      <Text
        style={[
          styles.textLabelSupporting,
          styles.textAlignCenter,
          styles.mt6,
        ]}>
        {translate('achievementsScreen.bac.disclaimer')}
      </Text>
    </ScrollView>
  );
}

BACResult.displayName = 'BACResult';
export default BACResult;
