import {useMemo} from 'react';
import {DashPathEffect} from '@shopify/react-native-skia';
import {
  Area,
  BaseChart,
  Line,
  useChartFont,
} from '@components/Charts/BaseChart';
import {
  roundTick,
  valueTicks,
} from '@components/Charts/BaseChart/axisFormatters';
import buildDateTicks from '@components/Charts/BaseChart/dateTicks';
import type {DrinkKey} from '@src/types/onyx/Drinks';

type StackedAreaProps = {
  /** ISO-week labels, one per row, index-aligned with `byKey` arrays. */
  weeks: string[];
  /** Per-key weekly totals; arrays length === weeks.length. */
  byKey: Partial<Record<DrinkKey, number[]>>;
  /** Order in which keys are stacked (innermost first → outermost last). */
  trackedKeys: readonly DrinkKey[];
  /** Per-key fill color. */
  palette: Partial<Record<DrinkKey, string>>;
  /** Optional comparison series — drawn as a single dashed total line. */
  comparisonTotal?: number[];
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
  /** When true, shows the BaseChart skeleton instead of the stack. */
  isLoading?: boolean;
};

const COMPARISON_DASH: number[] = [4, 4];
const COMPARISON_KEY = '__cmpTotal__';

/**
 * Weekly drink-type stacked area. Each tracked key contributes one Skia
 * `<Area>` layer; layers are pre-stacked at the data level (each row's
 * value for key Kn is the cumulative sum of K0..Kn). Layers render back-to-
 * front so the smallest cumulative sits on top — the visible thickness of
 * each layer corresponds to its underlying weekly total.
 *
 * Comparison mode adds a single dashed muted line tracing the previous
 * period's grand total (sum across keys). Seven dashed cumulative lines
 * would be visual mud; one total line carries the "vs last period"
 * comparison without competing with the stack itself.
 */
function StackedArea({
  weeks,
  byKey,
  trackedKeys,
  palette,
  comparisonTotal,
  accessibilityLabel,
  emptyLabel,
  height,
  isLoading,
}: StackedAreaProps) {
  const axisFont = useChartFont();
  const showComparison =
    !!comparisonTotal && comparisonTotal.length === weeks.length;

  const data = useMemo(
    () =>
      weeks.map((week, i) => {
        const row: Record<string, string | number> = {x: i};
        let running = 0;
        for (const key of trackedKeys) {
          running += byKey[key]?.[i] ?? 0;
          row[key] = running;
        }
        if (showComparison) {
          row[COMPARISON_KEY] = comparisonTotal?.[i] ?? 0;
        }
        return row;
      }),
    [weeks, byKey, trackedKeys, comparisonTotal, showComparison],
  );

  const yKeys = useMemo<readonly string[]>(
    () =>
      showComparison ? [...trackedKeys, COMPARISON_KEY] : [...trackedKeys],
    [trackedKeys, showComparison],
  );

  // Stack height per week is the cumulative of the outermost key; track the
  // peak (and comparison total) to place y ticks.
  const maxStack = useMemo(() => {
    const topKey = trackedKeys[trackedKeys.length - 1];
    let max = 1;
    for (const row of data) {
      const total = topKey ? Number(row[topKey] ?? 0) : 0;
      if (total > max) {
        max = total;
      }
      if (showComparison) {
        const cmp = Number(row[COMPARISON_KEY] ?? 0);
        if (cmp > max) {
          max = cmp;
        }
      }
    }
    return max;
  }, [data, trackedKeys, showComparison]);

  const dateTicks = useMemo(
    () =>
      buildDateTicks({
        firstKey: weeks[0] ?? '',
        lastKey: weeks[weeks.length - 1] ?? '',
        length: weeks.length,
        unit: 'week',
      }),
    [weeks],
  );
  const yTicks = useMemo(() => valueTicks(maxStack), [maxStack]);

  return (
    <BaseChart
      data={data}
      yKeys={yKeys}
      range="rolling8w"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
      axis={{
        font: axisFont,
        tickValues: {x: dateTicks.indices, y: yTicks},
        formatXLabel: dateTicks.labelFor,
        formatYLabel: roundTick,
      }}
      loading={isLoading}>
      {({points, chartBounds, theme}) => {
        const baseline = chartBounds.bottom;
        // Render back-to-front: highest cumulative first (drawn behind),
        // smallest cumulative last (drawn on top).
        const reversedKeys = [...trackedKeys].reverse();
        return (
          <>
            {reversedKeys.map(key => {
              const layerPoints = points[key];
              if (!layerPoints) return null;
              return (
                <Area
                  key={key}
                  points={layerPoints}
                  y0={baseline}
                  color={palette[key] ?? theme.primaryFill}
                  animate={{type: 'timing', duration: 200}}
                />
              );
            })}
            {showComparison ? (
              <Line
                points={points[COMPARISON_KEY]}
                color={theme.comparisonStroke}
                strokeWidth={1.5}>
                <DashPathEffect intervals={COMPARISON_DASH} />
              </Line>
            ) : null}
          </>
        );
      }}
    </BaseChart>
  );
}

export default StackedArea;
export type {StackedAreaProps};
